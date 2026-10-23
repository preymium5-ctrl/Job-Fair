import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { POST as submit } from "../app/api/applications/route";
import { proposedJobs } from "../data/jobs";
import { additionalApplicationJobs } from "../data/application-jobs";
import { getJobFairRole } from "../data/job-fair";
import { getDatabase, localModeAllowed } from "../lib/db";
import { supportingDocumentTypes, type SupportingDocumentCategory } from "../lib/document-uploads";
import { requireStorageConfiguration } from "../lib/storage";
import type { SheetsPayload } from "../lib/sheets-transport";
import { applicationSchema } from "../lib/validation";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const origin = "https://www.jobsincroatiaa.com";
const webhook = "https://script.google.com/macros/s/test-receiver/exec";
const secret = "synthetic-test-secret-with-at-least-32-characters";
const pdf = Buffer.from("%PDF-1.4\nSynthetic application document\n%%EOF\n");
const officialJob = proposedJobs.find(({ slug }) => slug === "fabricator")!;
const additionalJob = additionalApplicationJobs.find(({ title }) => !/driver/i.test(title))!;
const driverJob = [...proposedJobs, ...additionalApplicationJobs].find(({ title }) => /\bdrivers?\b/i.test(title))!;
const received: SheetsPayload[] = [];
const records = new Map<string, string>();
let receiver: (payload: SheetsPayload) => Response | Promise<Response>;

function values(jobId = officialJob.id) {
  return {
    jobId, fullName: "Synthetic Applicant", email: "synthetic@example.test", phone: "+639171234567",
    referralSource: "Facebook", recentJobTitle: "Fabricator", experienceYears: 5, skills: "Fabrication and welding",
    education: "Technical diploma", summary: "Synthetic professional summary", coverLetter: "Synthetic cover letter",
    nc2Certificate: "Metal Fabrication NC II", driverLicenseDetails: "Category B",
    documentReadiness: { nc2: "ready", diploma: "ready", nbi: "in-progress", form18a: "not-yet" },
    consent: true,
    profile: {
      firstName: "Synthetic", lastName: "Applicant", gender: "Female", nationality: "Filipino",
      address: "", street: "17 Sample Street", city: "Manila", province: "Metro Manila", postalCode: "0017",
      dateOfBirth: "1994-02-28", placeOfBirth: "Manila", destinationCountry: "Macedonia",
      currentWorkCountry: "Philippines", secondaryJobTitle: "Welder", otherJobTitle: "Cleaner",
      englishProficiency: "Yes", termsAccepted: true, telegram: "@synthetic",
      fatherName: "Synthetic Father", motherName: "Synthetic Mother",
    },
  };
}

function documentBytes(category: string) {
  return Buffer.from(`%PDF-1.4\nSynthetic ${category} document\n%%EOF\n`);
}

function request(options: {
  payload?: unknown;
  key?: string;
  categories?: SupportingDocumentCategory[];
  resume?: File;
  documentOverrides?: Partial<Record<SupportingDocumentCategory, File>>;
  requestOrigin?: string | null;
  legacyWebsite?: string;
  applicationChecks?: (string | File)[];
} = {}) {
  const form = new FormData();
  form.set("idempotencyKey", options.key || randomUUID());
  form.set("payload", JSON.stringify(options.payload ?? values()));
  form.set("resume", options.resume || new File([pdf], "resume.pdf", { type: "application/pdf" }));
  if (options.legacyWebsite !== undefined) form.set("website", options.legacyWebsite);
  for (const value of options.applicationChecks ?? []) form.append("applicationCheck", value);
  for (const category of options.categories ?? ["passport", "residence-id"]) {
    form.set(`document:${category}`, options.documentOverrides?.[category] || new File(
      [documentBytes(category)], `${category}.pdf`, { type: "application/pdf" },
    ));
  }
  return new NextRequest(`${origin}/api/applications`, {
    method: "POST", body: form,
    headers: options.requestOrigin === null ? {} : { origin: options.requestOrigin ?? origin },
  });
}

function acknowledge(payload: SheetsPayload) {
  const previous = records.get(payload.application.id);
  if (previous && previous !== payload.application.reference)
    return Response.json({ ok: false, code: "DUPLICATE_CONFLICT" });
  records.set(payload.application.id, payload.application.reference);
  return Response.json({
    ok: true, applicationId: payload.application.id, reference: payload.application.reference,
    row: 2, duplicate: previous !== undefined,
  });
}

before(() => {
  Object.assign(process.env, {
    NODE_ENV: "production", CHAPTER_LOCAL_MODE: "false", APP_ORIGIN: origin,
    APPLICATION_STORAGE: "google-sheets", GOOGLE_SHEETS_WEBHOOK_URL: webhook,
    GOOGLE_SHEETS_WEBHOOK_SECRET: secret,
  });
  for (const key of ["DATA_DIR", "DATABASE_URL", "SESSION_SECRET", "ADMIN_EMAIL", "ADMIN_PASSWORD", "S3_BUCKET", "S3_REGION", "S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"])
    delete process.env[key];
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), webhook, "The only external request is to the configured Google receiver");
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "manual");
    assert.equal(init?.cache, "no-store");
    const envelope = JSON.parse(String(init?.body)) as { timestamp: number; payload: string; signature: string };
    assert.ok(Number.isSafeInteger(envelope.timestamp));
    assert.equal(envelope.signature, createHmac("sha256", secret).update(`${envelope.timestamp}.${envelope.payload}`).digest("hex"));
    const payload = JSON.parse(envelope.payload) as SheetsPayload;
    received.push(payload);
    return receiver(payload);
  };
});

beforeEach(() => {
  received.length = 0;
  records.clear();
  receiver = acknowledge;
});

after(() => {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

test("Google mode accepts a production application while database, private storage and staff configuration are absent", async () => {
  assert.equal(localModeAllowed(), false);
  assert.equal(process.env.DATA_DIR, undefined);
  assert.equal(process.env.SESSION_SECRET, undefined);
  await assert.rejects(getDatabase(), /Production requires DATABASE_URL/);
  assert.throws(requireStorageConfiguration, /Production private storage is not configured/);
  const response = await submit(request());
  assert.equal(response.status, 201);
  assert.equal((await response.json()).reference, received[0].application.reference);
  assert.equal(received.length, 1);
});

test("autofilled website fields from already-open forms are accepted and retries recover one application", async () => {
  const key = randomUUID();
  const first = await submit(request({ key, legacyWebsite: "https://applicant.example" }));
  assert.equal(first.status, 201);
  const receipt = await first.json();
  const retry = await submit(request({ key, legacyWebsite: "https://applicant.example" }));
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), receipt);
  assert.equal(records.size, 1);
  assert.equal(received.length, 2);
  assert.equal(received[0].application.id, received[1].application.id);
});

test("the replacement application check accepts blank values and rejects filled, duplicate and file values before Google delivery", async () => {
  for (const applicationChecks of [
    ["spam"], ["", "spam"], [new File([pdf], "trap.pdf", { type: "application/pdf" })],
  ]) {
    const response = await submit(request({ applicationChecks }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, "The application could not be accepted.");
    assert.equal(Object.hasOwn(body, "reference"), false);
  }
  assert.equal(received.length, 0);
  assert.equal(records.size, 0);
  const accepted = await submit(request({ applicationChecks: [" \t "] }));
  assert.equal(accepted.status, 201);
  assert.equal(received.length, 1);
});

test("an official job sends every captured answer, all nine documents and the CV in an authenticated version 3 payload", async () => {
  const input = values();
  const key = randomUUID();
  const categories = supportingDocumentTypes.map(({ id }) => id);
  const response = await submit(request({ payload: input, key, categories }));
  assert.equal(response.status, 201);
  const receipt = await response.json();
  assert.deepEqual(Object.keys(receipt).sort(), ["jobTitle", "reference"]);
  assert.equal(receipt.jobTitle, officialJob.title);
  const payload = received[0];
  assert.equal(payload.version, 3);
  assert.equal(payload.application.id, `gs-${key}`);
  assert.match(receipt.reference, /^CH-[A-F0-9]{24}$/);
  assert.equal(receipt.reference, payload.application.reference);
  const parsed = applicationSchema.parse(input);
  assert.deepEqual(payload.application.profile, parsed.profile);
  for (const field of ["jobId", "fullName", "email", "phone", "country", "referralSource", "recentJobTitle", "experienceYears", "skills", "education", "coverLetter", "nc2Certificate", "driverLicenseDetails", "documentReadiness", "consent"] as const)
    assert.deepEqual(payload.application[field], parsed[field], field);
  assert.match(payload.application.summary, /Synthetic professional summary/);
  assert.equal(payload.application.applicationSource, "Jobs in Croatia");
  assert.equal(payload.application.applicationFormVersion, "profile-v1");
  assert.equal(payload.application.expectedNc2, getJobFairRole(officialJob)?.nc2);
  assert.equal(payload.application.status, "New");
  assert.ok(Number.isFinite(Date.parse(payload.application.submittedAt)));
  assert.deepEqual(payload.resume, { name: "resume.pdf", mime: "application/pdf", base64: pdf.toString("base64") });
  assert.deepEqual(payload.documents?.map(({ category }) => category), categories);
  for (const document of payload.documents || []) {
    assert.equal(document.id, `gs-${key}-${document.category}`);
    assert.equal(document.name, `${document.category}.pdf`);
    assert.equal(document.mime, "application/pdf");
    assert.equal(document.base64, documentBytes(document.category).toString("base64"));
  }
  for (const privateField of ["resumeKey", "resumeName", "resumeMime", "isExample", "documents"])
    assert.equal(Object.hasOwn(payload.application, privateField), false, privateField);
});

test("promoted jobs are accepted from the published additional job list without database access", async () => {
  assert.equal(Boolean(additionalJob.applicationOnly), false);
  const response = await submit(request({ payload: values(additionalJob.id) }));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).jobTitle, additionalJob.title);
  assert.equal(received[0].application.jobId, additionalJob.id);
  assert.equal(received[0].application.jobTitle, additionalJob.title);
});

test("retries retain application, reference and document IDs while changed answers or document bytes get a conflicting reference", async () => {
  const key = randomUUID();
  const categories = supportingDocumentTypes.map(({ id }) => id);
  const first = await submit(request({ key, categories }));
  assert.equal(first.status, 201);
  const firstReceipt = await first.json();
  const retry = await submit(request({ key, categories }));
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), firstReceipt);
  assert.equal(received[1].application.id, received[0].application.id);
  assert.equal(received[1].application.reference, received[0].application.reference);
  assert.deepEqual(received[1].documents, received[0].documents);
  const changed = values();
  changed.profile.telegram = "@changed";
  const changedAnswer = await submit(request({ key, categories, payload: changed }));
  assert.equal(changedAnswer.status, 409);
  assert.equal(Object.hasOwn(await changedAnswer.json(), "reference"), false);
  assert.equal(received[2].application.id, received[0].application.id);
  assert.notEqual(received[2].application.reference, received[0].application.reference);
  const changedDocument = await submit(request({ key, categories, documentOverrides: {
    passport: new File([Buffer.from("%PDF-1.4\nChanged passport\n%%EOF\n")], "passport.pdf"),
  } }));
  assert.equal(changedDocument.status, 409);
  assert.notEqual(received[3].application.reference, received[0].application.reference);
  assert.notEqual(received[3].application.reference, received[2].application.reference);
  const anotherSubmission = await submit(request({ categories }));
  assert.equal(anotherSubmission.status, 201);
  assert.notEqual((await anotherSubmission.json()).reference, firstReceipt.reference);
});

test("receiver conflicts are returned as 409 without a success reference", async () => {
  receiver = () => Response.json({ ok: false, code: "DUPLICATE_CONFLICT" });
  const response = await submit(request());
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.match(body.error, /submission ID was already used/);
  assert.equal(Object.hasOwn(body, "reference"), false);
});

test("receiver outages and unverifiable receipts return 503 without a reference", async () => {
  const failures: typeof receiver[] = [
    () => { throw new Error("Synthetic receiver network failure"); },
    () => new Response("Unavailable", { status: 503 }),
    (payload) => Response.json({ ok: true, applicationId: payload.application.id, reference: "WRONG-REFERENCE", row: 2, duplicate: false }),
    (payload) => Response.json({ ok: true, applicationId: payload.application.id, reference: payload.application.reference, row: 1, duplicate: false }),
  ];
  for (const failure of failures) {
    receiver = failure;
    const response = await submit(request());
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(Object.hasOwn(body, "reference"), false);
    assert.match(body.error, /couldn’t confirm your application with Google Sheets/);
  }
});

test("Google mode requires the current structured profile and rejects a valid legacy request before contacting Google", async () => {
  const { profile: omitted, ...legacy } = values();
  void omitted;
  const response = await submit(request({ payload: { ...legacy, country: "Philippines" } }));
  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /current website application form/);
  assert.equal(received.length, 0);
});

test("missing or invalid referral answers are rejected before delivery and every offered answer is delivered", async () => {
  for (const referralSource of [undefined, "", "   ", "Unlisted source"]) {
    const response = await submit(request({ payload: { ...values(), referralSource } }));
    assert.equal(response.status, 422);
    assert.ok((await response.json()).fieldErrors.referralSource);
  }
  assert.equal(received.length, 0);
  for (const referralSource of ["Facebook", "TikTok", "Instagram", "Reddit", "YouTube", "Google Search", "Friend or family", "Other"]) {
    const response = await submit(request({ payload: { ...values(), referralSource } }));
    assert.equal(response.status, 201);
    assert.equal(received.at(-1)?.application.referralSource, referralSource);
  }
});

test("passport and residence ID are required, with a driver's license additionally required for driver applicants", async () => {
  for (const [categories, missing] of [
    [[], ["document:passport", "document:residence-id"]],
    [["passport"], ["document:residence-id"]],
    [["residence-id"], ["document:passport"]],
  ] as [SupportingDocumentCategory[], string[]][]) {
    const response = await submit(request({ categories }));
    assert.equal(response.status, 422);
    assert.deepEqual(Object.keys((await response.json()).fieldErrors).sort(), missing.sort());
  }
  const driver = await submit(request({ payload: values(driverJob.id) }));
  assert.equal(driver.status, 422);
  assert.deepEqual(Object.keys((await driver.json()).fieldErrors), ["document:driver-license"]);
  assert.equal(received.length, 0);
  const accepted = await submit(request({ payload: values(driverJob.id), categories: ["passport", "residence-id", "driver-license"] }));
  assert.equal(accepted.status, 201);
  assert.equal((await accepted.json()).jobTitle, driverJob.title);
});

test("invalid resume and document contents fail validation before Google receives any personal data", async () => {
  const invalidResume = await submit(request({ resume: new File(["This is not a PDF"], "resume.pdf") }));
  assert.equal(invalidResume.status, 422);
  assert.match((await invalidResume.json()).fieldErrors.resume, /PDF signature/);
  const invalidDocument = await submit(request({ documentOverrides: { passport: new File(["This is not a PDF"], "passport.pdf") } }));
  assert.equal(invalidDocument.status, 422);
  assert.match((await invalidDocument.json()).fieldErrors["document:passport"], /PDF signature/);
  assert.equal(received.length, 0);
});

test("cross-site submissions and requests without an Origin header remain forbidden without calling Google", async () => {
  for (const requestOrigin of ["https://unrelated.example", "https://jobsincroatiaa.com", null]) {
    const response = await submit(request({ requestOrigin }));
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.error, "Submit your application from this website.");
    assert.equal(Object.hasOwn(body, "reference"), false);
  }
  assert.equal(received.length, 0);
});
