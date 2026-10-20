import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHmac, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { closeDatabase, getDatabase } from "../lib/db";
import { createApplication, getJobs } from "../lib/repository";
import { sheetDeliveries } from "../lib/schema";
import { drainSheetsQueue, sheetsQueueStatus } from "../lib/sheets-queue";
import { buildSheetsPayload, sendApplicationToSheets, sheetsConfiguration, SheetsDeliveryError, type SheetsPayload } from "../lib/sheets-transport";
import { applicationSchema } from "../lib/validation";
import type { Application, ApplicationProfile, Job } from "../lib/types";
import { getGroupedJobFairRole, getJobFairRole } from "../data/job-fair";
import { proposedJobs } from "../data/jobs";
import { NextRequest } from "next/server";
import { POST as submit } from "../app/api/applications/route";
import { GET as integrationStatus, POST as integrationRetry } from "../app/api/admin/integrations/google-sheets/route";

const originalEnv = { ...process.env };
let temporaryDirectory = "";
let job: Job;
const resume = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "chapter-sheets-test-"));
  Object.assign(process.env, { NODE_ENV: "test", DATA_DIR: temporaryDirectory, CHAPTER_LOCAL_MODE: "true", APP_ORIGIN: "http://localhost:3000" });
  for (const key of ["DATABASE_URL", "S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "GOOGLE_SHEETS_WEBHOOK_URL", "GOOGLE_SHEETS_WEBHOOK_SECRET"])
    delete process.env[key];
  job = (await getJobs())[0];
});
after(async () => {
  await closeDatabase();
  if (!path.resolve(temporaryDirectory).startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(temporaryDirectory).startsWith("chapter-sheets-test-"))
    throw new Error("Unexpected test cleanup path.");
  await rm(temporaryDirectory, { recursive: true, force: true });
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});
function applicant(): Application {
  const id = randomUUID();
  return {
    id, reference: `CH-TEST-${id}`, jobId: job.id, jobTitle: job.title,
    fullName: "Integration Test Applicant", email: `${id}@example.test`, phone: "+63 917 123 4567", country: "Philippines",
    recentJobTitle: "Fabricator", experienceYears: 3, skills: "Workshop fabrication", education: "High school", summary: "", coverLetter: "", consent: true,
    nc2Certificate: "NC2 Fabricator", documentReadiness: { nc2: "ready", diploma: "ready", nbi: "in-progress", form18a: "not-yet" },
    preferredEmployer: "", status: "New", submittedAt: new Date().toISOString(), resumeName: "resume.pdf", resumeMime: "application/pdf", resumeKey: `resumes/${randomUUID()}.pdf`, isExample: false,
  };
}
async function record() {
  const application = applicant();
  await createApplication(application, randomUUID(), "test-request-hash");
  return application;
}
async function delivery(id: string) {
  return (await (await getDatabase()).select().from(sheetDeliveries).where(eq(sheetDeliveries.applicationId, id)))[0];
}

test("document readiness validates certificate details and retains legacy form compatibility", () => {
  const full = applicant();
  const { id: _id, reference: _reference, jobTitle: _title, status: _status, submittedAt: _date, resumeName: _name, resumeMime: _mime, resumeKey: _key, isExample: _example, ...input } = full;
  void _id; void _reference; void _title; void _status; void _date; void _name; void _mime; void _key; void _example;
  assert.equal(applicationSchema.safeParse(input).success, true);
  assert.equal(applicationSchema.safeParse({ ...input, nc2Certificate: "" }).success, false);
  assert.equal(applicationSchema.safeParse({ ...input, documentReadiness: { ...input.documentReadiness, nbi: "uploaded" } }).success, false);
  assert.equal(applicationSchema.safeParse({ ...input, documentReadiness: undefined, nc2Certificate: undefined, preferredEmployer: undefined }).success, true);
});

test("legacy applications export complete document readiness and empty certificate fields", () => {
  const legacy = { ...applicant(), documentReadiness: undefined, nc2Certificate: undefined, preferredEmployer: undefined };
  const payload = buildSheetsPayload(legacy, resume, job);
  assert.deepEqual(payload.application.documentReadiness, { nc2: "not-yet", diploma: "not-yet", nbi: "not-yet", form18a: "not-yet" });
  assert.equal(payload.application.nc2Certificate, "");
  assert.equal(payload.application.preferredEmployer, "");
  assert.equal(payload.application.referralSource, "");
});

test("each of the 23 selected positions persists and exports its own employer", async () => {
  const catalog = await getJobs();
  for (const position of proposedJobs) {
    const selected = catalog.find((item) => item.id === position.id)!;
    assert.ok(selected, position.slug);
    const input = { ...applicant(), jobId: selected.id, jobTitle: "Untrusted browser title" };
    const { application: stored } = await createApplication(input, randomUUID(), "employer-position-test");
    const employer = getJobFairRole(selected)!.employers[0];
    assert.equal(stored.jobId, selected.id);
    assert.equal(stored.jobTitle, selected.title);
    assert.equal(stored.preferredEmployer, employer.name);
    const payload = buildSheetsPayload(stored, resume, selected);
    assert.equal(payload.application.preferredEmployer, employer.name);
    assert.deepEqual(payload.application.employers, [{ name: employer.name, workers: employer.workers }]);
  }
});

test("queued grouped applications retain blank or explicit employer preferences after the split", () => {
  const fabricator = proposedJobs.find((item) => item.slug === "fabricator")!;
  const expected = getGroupedJobFairRole(fabricator)!.employers.map(({ name, workers }) => ({ name, workers }));
  for (const preferredEmployer of ["", "Vertiv", "Ferokotao d.o.o."]) {
    const payload = buildSheetsPayload({ ...applicant(), jobId: fabricator.id, preferredEmployer }, resume, fabricator);
    assert.equal(payload.application.preferredEmployer, preferredEmployer);
    assert.deepEqual(payload.application.employers, expected);
  }
});

test("all bounded profile answers and private filenames fit the existing Sheets summary without new receiver keys", () => {
  const profile: ApplicationProfile = {
    firstName: "F".repeat(59), lastName: "L".repeat(60), gender: "Female", nationality: "N".repeat(80),
    address: "A".repeat(300), dateOfBirth: "1990-01-01", placeOfBirth: "P".repeat(120), destinationCountry: "Croatia",
    currentWorkCountry: "C".repeat(80), secondaryJobTitle: "J".repeat(160), englishProficiency: "No", termsAccepted: true,
    telegram: "T".repeat(80), fatherName: "D".repeat(120), motherName: "M".repeat(120), otherJobTitle: "O".repeat(160),
  };
  const categories = ["passport", "residence-id", "employment-certificate"] as const;
  const application = { ...applicant(), fullName: `${profile.firstName} ${profile.lastName}`, profile, summary: "S".repeat(1000), recentJobTitle: "", experienceYears: null, skills: "",
    documents: categories.map((category) => ({ id: randomUUID(), category, key: `documents/${randomUUID()}.pdf`, name: `${category}-${"x".repeat(160)}.pdf`, mime: "application/pdf", size: resume.length })) };
  const payload = buildSheetsPayload(application, resume, job, application.documents.map(({ key: _key, size: _size, ...document }) => {
    void _key; void _size; return { ...document, base64: resume.toString("base64") };
  }));
  assert.equal(payload.version, 1);
  assert.equal(payload.documents, undefined);
  assert.equal("profile" in payload.application, false);
  assert.ok(payload.application.summary.length <= 4000);
  for (const value of Object.values(profile))
    if (typeof value === "string") assert.ok(payload.application.summary.includes(value));
  for (const document of application.documents) assert.ok(payload.application.summary.includes(document.name));
  assert.ok(payload.application.summary.endsWith(application.summary));
  assert.match(payload.application.summary, /Terms accepted: Yes/);
  const structuredProfile: ApplicationProfile = { ...profile, street: "s".repeat(140), city: "c".repeat(60), province: "p".repeat(60), postalCode: "0".repeat(20) };
  structuredProfile.address = [structuredProfile.street, structuredProfile.city, structuredProfile.province, structuredProfile.postalCode].join(", ");
  const structuredPayload = buildSheetsPayload({ ...application, profile: structuredProfile }, resume, job);
  assert.ok(structuredPayload.application.summary.length <= 4000);
  assert.ok(structuredPayload.application.summary.endsWith(application.summary));
  for (const [label, value] of [["Street", structuredProfile.street], ["City", structuredProfile.city], ["Province", structuredProfile.province], ["Postal code", structuredProfile.postalCode]])
    assert.ok(structuredPayload.application.summary.includes(`${label}: ${value}`));
  assert.ok(!structuredPayload.application.summary.includes(`Address: ${structuredProfile.address}`));
  assert.equal("profile" in structuredPayload.application, false);
  const legacy = { ...application, profile: undefined, summary: "L".repeat(4000) };
  const legacyPayload = buildSheetsPayload(legacy, resume, job);
  assert.equal(legacy.summary.length, 4000);
  assert.ok(legacyPayload.application.summary.length <= 4000);
  assert.match(legacyPayload.application.summary, /Full professional summary available in recruitment workspace/);
  for (const document of application.documents) assert.ok(legacyPayload.application.summary.includes(document.name));
});

test("Sheets address export retains the combined legacy value and labels structured pieces without changing receiver fields", () => {
  const profile: ApplicationProfile = { firstName: "Test", lastName: "Applicant", gender: "Female", nationality: "Filipino",
    address: "Legacy full address", dateOfBirth: "1990-01-01", placeOfBirth: "Manila", destinationCountry: "Croatia",
    currentWorkCountry: "Philippines", secondaryJobTitle: "Welder", englishProficiency: "Yes", termsAccepted: true };
  const legacy = buildSheetsPayload({ ...applicant(), profile }, resume, job);
  assert.match(legacy.application.summary, /Address: Legacy full address/);
  assert.doesNotMatch(legacy.application.summary, /Street:|Postal code:/);
  const structured = buildSheetsPayload({ ...applicant(), profile: { ...profile, address: "17 Sample Street, Manila, Metro Manila, 0017",
    street: "17 Sample Street", city: "Manila", province: "Metro Manila", postalCode: "0017" } }, resume, job);
  assert.match(structured.application.summary, /Street: 17 Sample Street\nCity: Manila\nProvince: Metro Manila\nPostal code: 0017/);
  assert.doesNotMatch(structured.application.summary, /Address:/);
  assert.deepEqual(Object.keys(structured.application).sort(), Object.keys(legacy.application).sort());
  assert.equal("street" in structured.application, false);
});

test("Sheets payload preserves each referral source and normalizes an unanswered source", () => {
  for (const referralSource of ["Facebook", "TikTok", "Instagram", "Reddit", "YouTube", "Google Search", "Friend or family", "Other"]) {
    const payload = buildSheetsPayload({ ...applicant(), referralSource }, resume, job);
    assert.equal(payload.application.referralSource, referralSource);
    assert.ok(!("resumeKey" in payload.application));
    assert.ok(!("isExample" in payload.application));
  }
  assert.equal(buildSheetsPayload({ ...applicant(), referralSource: "" }, resume, job).application.referralSource, "");
});

test("new applications atomically queue exactly once and remain queued without configuration", async () => {
  const application = applicant();
  const key = randomUUID();
  const created = await createApplication(application, key, "same");
  const duplicate = await createApplication({ ...application, id: randomUUID() }, key, "same");
  assert.equal(created.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.application.id, application.id);
  assert.equal((await delivery(application.id)).state, "pending");
  assert.equal(await delivery(application.id).then((row) => row.attempts), 0);
  assert.deepEqual(await drainSheetsQueue({ applicationId: application.id }), { delivered: 0, deferred: 0, configured: false });
  assert.equal((await delivery(application.id)).attempts, 0);
  assert.equal((await sheetsQueueStatus()).configuration, "not-configured");
});

test("delivery survives an ambiguous remote failure, restarts and deduplicates row and private CV", async () => {
  const application = await record();
  let now = new Date();
  let remoteCalls = 0;
  const remoteRows = new Map<string, number>();
  const privateFiles = new Set<string>();
  const transport = async (payload: SheetsPayload) => {
    remoteCalls++;
    const duplicate = remoteRows.has(payload.application.id);
    if (!duplicate) {
      privateFiles.add(payload.application.id);
      remoteRows.set(payload.application.id, 2);
    }
    if (remoteCalls === 1) throw new Error("Response lost after Google persisted data");
    return { ok: true as const, applicationId: payload.application.id, reference: payload.application.reference, row: remoteRows.get(payload.application.id)!, duplicate };
  };
  const options = { applicationId: application.id, limit: 1 };
  const dependencies = { transport, readResume: async () => resume, now: () => now };
  assert.equal((await drainSheetsQueue(options, dependencies)).deferred, 1);
  const failed = await delivery(application.id);
  assert.equal(failed.state, "pending");
  assert.equal(failed.lastError, "WEBHOOK_UNAVAILABLE");
  assert.equal(failed.attempts, 1);
  assert.ok(failed.nextAttemptAt > now);
  await closeDatabase();
  assert.equal((await delivery(application.id)).state, "pending");
  assert.equal((await drainSheetsQueue(options, dependencies)).delivered, 0);
  now = new Date(now.getTime() + 31_000);
  assert.equal((await drainSheetsQueue(options, dependencies)).delivered, 1);
  assert.equal((await delivery(application.id)).state, "synced");
  assert.equal((await delivery(application.id)).sheetRow, 2);
  assert.equal((await drainSheetsQueue(options, dependencies)).delivered, 0);
  assert.equal(remoteCalls, 2);
  assert.equal(remoteRows.size, 1);
  assert.equal(privateFiles.size, 1);
});

test("leased delivery permits one worker and invalid acknowledgements remain queued", async () => {
  const application = await record();
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const claimed = new Promise<void>((resolve) => { started = resolve; });
  const dependencies = { readResume: async () => resume, transport: async (payload: SheetsPayload) => {
    started();
    await gate;
    return { ok: true as const, applicationId: payload.application.id, reference: "wrong-reference", row: 2, duplicate: false };
  } };
  const first = drainSheetsQueue({ applicationId: application.id, limit: 1 }, dependencies);
  await claimed;
  assert.equal((await drainSheetsQueue({ applicationId: application.id, limit: 1 }, dependencies)).delivered, 0);
  release();
  assert.equal((await first).deferred, 1);
  const row = await delivery(application.id);
  assert.equal(row.attempts, 1);
  assert.equal(row.lastError, "INVALID_ACKNOWLEDGEMENT");
});

test("webhook signing, destination restrictions, private data boundary and exact Google acknowledgement", async () => {
  assert.equal(sheetsConfiguration({ GOOGLE_SHEETS_WEBHOOK_URL: "https://hostile.example/exec", GOOGLE_SHEETS_WEBHOOK_SECRET: "s".repeat(48) }).valid, false);
  assert.equal(sheetsConfiguration({ GOOGLE_SHEETS_WEBHOOK_URL: "https://script.google.com/macros/s/example/exec?redirect=other", GOOGLE_SHEETS_WEBHOOK_SECRET: "s".repeat(48) }).valid, false);
  assert.equal(sheetsConfiguration({ GOOGLE_SHEETS_WEBHOOK_URL: "https://script.google.com/macros/s/example/exec", GOOGLE_SHEETS_WEBHOOK_SECRET: "short" }).valid, false);
  process.env.GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/test-deployment/exec";
  process.env.GOOGLE_SHEETS_WEBHOOK_SECRET = "test-signature-secret-".repeat(3);
  const application = applicant();
  const payload = buildSheetsPayload(application, resume, job);
  assert.equal("resumeKey" in payload.application, false);
  assert.deepEqual(payload.application.employers, getGroupedJobFairRole(job)?.employers.map(({ name, workers }) => ({ name, workers })) || []);
  assert.equal(payload.resume.base64, resume.toString("base64"));
  const originalFetch = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async (url, init) => {
      calls++;
      if (calls === 1) {
        assert.equal(String(url), process.env.GOOGLE_SHEETS_WEBHOOK_URL);
        assert.equal(init?.method, "POST");
        const outer = JSON.parse(String(init?.body));
        assert.equal(outer.signature, createHmac("sha256", process.env.GOOGLE_SHEETS_WEBHOOK_SECRET!).update(`${outer.timestamp}.${outer.payload}`).digest("hex"));
        assert.deepEqual(JSON.parse(outer.payload), payload);
        return new Response(null, { status: 302, headers: { location: "https://script.googleusercontent.com/macros/echo?user_content_key=test" } });
      }
      assert.equal(init?.method, "GET");
      assert.equal(init?.body, undefined);
      return Response.json({ ok: true, applicationId: application.id, reference: application.reference, row: 2, duplicate: false });
    };
    assert.equal((await sendApplicationToSheets(payload)).row, 2);
    assert.equal(calls, 2);
    globalThis.fetch = async () => Response.json({ ok: true, applicationId: application.id, reference: "incorrect", row: 2, duplicate: false });
    await assert.rejects(sendApplicationToSheets(payload), (error: unknown) => error instanceof SheetsDeliveryError && error.code === "INVALID_ACKNOWLEDGEMENT");
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: "https://hostile.example/steal" } });
    await assert.rejects(sendApplicationToSheets(payload), (error: unknown) => error instanceof SheetsDeliveryError && error.code === "WEBHOOK_REJECTED");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    delete process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;
  }
});

test("application API validates role-specific employers before accepting uploaded CVs", async () => {
  const application = applicant();
  const { id: _id, reference: _reference, jobTitle: _title, status: _status, submittedAt: _date, resumeName: _name, resumeMime: _mime, resumeKey: _key, isExample: _example, ...input } = application;
  void _id; void _reference; void _title; void _status; void _date; void _name; void _mime; void _key; void _example;
  const form = new FormData();
  form.set("payload", JSON.stringify({ ...input, preferredEmployer: "Unlisted Employer" }));
  form.set("idempotencyKey", randomUUID());
  form.set("resume", new File([resume], "resume.pdf", { type: "application/pdf" }));
  const response = await submit(new NextRequest("http://localhost:3000/api/applications", { method: "POST", headers: { origin: "http://localhost:3000" }, body: form }));
  assert.equal(response.status, 422);
  assert.ok((await response.json()).fieldErrors.preferredEmployer);
});

test("integration status and retry cannot be accessed without staff authentication or from another origin", async () => {
  const url = "http://localhost:3000/api/admin/integrations/google-sheets";
  assert.equal((await integrationStatus(new NextRequest(url))).status, 401);
  assert.equal((await integrationRetry(new NextRequest(url, { method: "POST", headers: { origin: "http://localhost:3000" } }))).status, 401);
  assert.equal((await integrationRetry(new NextRequest(url, { method: "POST", headers: { origin: "https://other.example" } }))).status, 403);
});
