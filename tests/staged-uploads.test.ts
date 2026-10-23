import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { proposedJobs } from "../data/jobs";
import { additionalApplicationJobs } from "../data/application-jobs";
import { POST as uploadRoute } from "../app/api/applications/uploads/route";
import { POST as submitApplication } from "../app/api/applications/route";
import type { SheetsPayload } from "../lib/sheets-transport";
import { initializeStagedUpload, MAX_STAGED_ENVELOPE_BYTES, MAX_STAGED_REQUEST_BYTES, restoreStagedFormData, STAGED_UPLOAD_CHUNK_BYTES, StagedUploadError, uploadStagedChunk, type StagedUploadStart } from "../lib/staged-uploads";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const origin = "https://www.jobsincroatiaa.com";
const webhook = "https://script.google.com/macros/s/test-staged-receiver/exec";
const secret = "synthetic-staging-secret-".repeat(3);
const job = proposedJobs.find(({ slug }) => slug === "fabricator")!;
const operations: Record<string, unknown>[] = [];
const sessions = new Map<string, { manifest: Record<string, unknown>; chunks: Map<number, string> }>();
const applications = new Map<string, string>();
const delivered: SheetsPayload[] = [];
let replyOverride: ((operation: Record<string, unknown>) => Response | undefined) | undefined;

function payload(jobId = job.id) {
  return {
    jobId, fullName: "Staged Applicant", email: "staged@example.test", phone: "+639171234567", referralSource: "Facebook", consent: true,
    profile: {
      firstName: "Staged", lastName: "Applicant", gender: "Female", address: "17 Sample Street", dateOfBirth: "1994-02-28",
      placeOfBirth: "Manila", destinationCountry: "Croatia", currentWorkCountry: "Philippines", secondaryJobTitle: "Welder",
      englishProficiency: "Yes", termsAccepted: true,
    },
  };
}
function pdf(size = 100) {
  const bytes = Buffer.alloc(size, " ");
  bytes.write("%PDF-1.4\n");
  bytes.write("\n%%EOF\n", size - 7);
  return bytes;
}
async function envelope(options: { fileBytes?: number; values?: unknown; key?: string; actualKey?: string; omit?: string[]; fileOverrides?: { field: string; name: string; size: number; type: string }[]; legacyWebsite?: string; applicationChecks?: (string | File)[] } = {}) {
  const key = options.key || randomUUID();
  const values = options.values ?? payload();
  const body = new FormData();
  body.set("payload", JSON.stringify(values));
  body.set("idempotencyKey", options.actualKey || key);
  body.set("website", options.legacyWebsite ?? "");
  for (const value of options.applicationChecks ?? []) body.append("applicationCheck", value);
  const files: StagedUploadStart["files"] = [];
  for (const field of ["resume", "document:passport", "document:residence-id"]) {
    if (options.omit?.includes(field)) continue;
    const file = new File([pdf(options.fileBytes || 100)], `${field.replace(":", "-")}.pdf`, { type: "application/pdf" });
    body.set(field, file);
    files.push({ field, name: file.name, size: file.size, type: file.type });
  }
  const serialized = new Response(body);
  const bytes = Buffer.from(await serialized.arrayBuffer());
  const start: StagedUploadStart = {
    payload: values, submissionKey: key,
    upload: {
      sha256: createHash("sha256").update(bytes).digest("hex"), totalBytes: bytes.length,
      chunkCount: Math.ceil(bytes.length / STAGED_UPLOAD_CHUNK_BYTES), contentType: serialized.headers.get("content-type")!,
    },
    files: options.fileOverrides || files,
  };
  return { bytes, start, values, key };
}
async function stage(input: Awaited<ReturnType<typeof envelope>>) {
  const initialized = await initializeStagedUpload(input.start, "203.0.113.1");
  for (let index = 0; index < initialized.chunkCount; index++) {
    const bytes = input.bytes.subarray(index * STAGED_UPLOAD_CHUNK_BYTES, (index + 1) * STAGED_UPLOAD_CHUNK_BYTES);
    const ack = await uploadStagedChunk(initialized.ticket, index, bytes.toString("base64"));
    assert.equal(ack.bytes, bytes.length);
    assert.equal(ack.sha256, createHash("sha256").update(bytes).digest("hex"));
  }
  return initialized;
}
function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`${origin}/api/applications/uploads`, {
    method: "POST", headers: { origin, "content-type": "application/json", ...headers }, body: JSON.stringify(body),
  });
}
async function receiver(url: string | URL | Request, init?: RequestInit) {
  assert.equal(String(url), webhook, "Staging never sends private content to another service");
  assert.equal(init?.method, "POST");
  assert.equal(init?.redirect, "manual");
  assert.equal(init?.cache, "no-store");
  const signed = JSON.parse(String(init?.body));
  assert.deepEqual(Object.keys(signed).sort(), ["payload", "signature", "timestamp"]);
  assert.equal(signed.signature, createHmac("sha256", secret).update(`${signed.timestamp}.${signed.payload}`).digest("hex"));
  const operation = JSON.parse(signed.payload) as Record<string, unknown>;
  operations.push(operation);
  const override = replyOverride?.(operation);
  if (override) return override;
  if (operation.version === 3 && operation.application) {
    const payload = operation as unknown as SheetsPayload;
    const previous = applications.get(payload.application.id);
    if (previous && previous !== payload.application.reference) return Response.json({ ok: false, code: "DUPLICATE_CONFLICT" });
    applications.set(payload.application.id, payload.application.reference);
    delivered.push(payload);
    return Response.json({ ok: true, applicationId: payload.application.id, reference: payload.application.reference, row: 2, duplicate: Boolean(previous) });
  }
  assert.equal(operation.version, 1);
  if (operation.operation === "upload-stage-init") {
    assert.deepEqual(Object.keys(operation).sort(), ["manifest", "operation", "version"]);
    const manifest = operation.manifest as Record<string, unknown>;
    assert.deepEqual(Object.keys(manifest).sort(), ["chunkCount", "chunkSize", "clientKey", "contentType", "emailKey", "expiresAt", "id", "idempotencyKey", "sha256", "size", "source"]);
    assert.equal(manifest.source, "Jobs in Croatia");
    assert.equal(manifest.chunkSize, STAGED_UPLOAD_CHUNK_BYTES);
    assert.match(String(manifest.emailKey), /^[a-f0-9]{64}$/);
    assert.match(String(manifest.clientKey), /^[a-f0-9]{64}$/);
    assert.ok(Number(manifest.expiresAt) > Date.now() && Number(manifest.expiresAt) <= Date.now() + 3600000);
    const existing = sessions.get(String(manifest.id));
    if (existing) assert.deepEqual(existing.manifest, manifest);
    else sessions.set(String(manifest.id), { manifest, chunks: new Map() });
    return Response.json({ ok: true, sessionId: manifest.id });
  }
  const state = sessions.get(String(operation.sessionId));
  if (!state) return Response.json({ ok: false, code: "UPLOAD_STAGE_NOT_FOUND" });
  if (operation.operation === "upload-stage-write") {
    assert.deepEqual(Object.keys(operation).sort(), ["base64", "index", "operation", "sessionId", "version"]);
    const previous = state.chunks.get(Number(operation.index));
    if (previous && previous !== operation.base64) return Response.json({ ok: false, code: "UPLOAD_STAGE_CONFLICT" });
    state.chunks.set(Number(operation.index), String(operation.base64));
    return Response.json({ ok: true, sessionId: operation.sessionId, index: operation.index, size: Buffer.from(String(operation.base64), "base64").length });
  }
  assert.equal(operation.operation, "upload-stage-read");
  assert.deepEqual(Object.keys(operation).sort(), ["index", "operation", "sessionId", "version"]);
  const base64 = state.chunks.get(Number(operation.index));
  return base64 ? Response.json({ ok: true, sessionId: operation.sessionId, index: operation.index, base64 })
    : Response.json({ ok: false, code: "UPLOAD_STAGE_NOT_FOUND" });
}

before(() => {
  Object.assign(process.env, { NODE_ENV: "production", APPLICATION_STORAGE: "google-sheets", CHAPTER_LOCAL_MODE: "false", APP_ORIGIN: origin,
    GOOGLE_SHEETS_WEBHOOK_URL: webhook, GOOGLE_SHEETS_WEBHOOK_SECRET: secret, TRUST_PROXY: "false" });
  delete process.env.VERCEL;
  globalThis.fetch = receiver;
});
beforeEach(() => { operations.length = 0; sessions.clear(); applications.clear(); delivered.length = 0; replyOverride = undefined; globalThis.fetch = receiver; });
after(() => {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

test("three 5 MiB documents stage in eight bounded requests and restore the exact multipart files for normal validation", async () => {
  const input = await envelope({ fileBytes: 5 * 1024 * 1024 });
  assert.ok(input.bytes.length < MAX_STAGED_ENVELOPE_BYTES);
  const initialized = await stage(input);
  assert.equal(initialized.chunkCount, 8);
  assert.ok(initialized.ticket.length < 4096);
  assert.ok(!initialized.ticket.includes(secret));
  const restored = await restoreStagedFormData(initialized.ticket);
  assert.equal(restored.get("idempotencyKey"), input.key);
  assert.deepEqual(JSON.parse(String(restored.get("payload"))), input.values);
  for (const field of ["resume", "document:passport", "document:residence-id"]) {
    const file = restored.get(field) as File;
    assert.equal(file.size, 5 * 1024 * 1024);
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), pdf(file.size));
  }
  assert.ok(operations.filter(({ operation }) => operation === "upload-stage-write").every((operation) => JSON.stringify(operation).length < MAX_STAGED_REQUEST_BYTES));
  const retained = sessions.get(initialized.uploadId)!.chunks.size;
  assert.equal(retained, 8, "Keep private chunks until expiry for lost-acknowledgement recovery");
  assert.equal((await restoreStagedFormData(initialized.ticket)).get("idempotencyKey"), input.key);
});

test("the final application route validates and delivers three complete 5 MiB documents and recovers an unchanged retry", async () => {
  const input = await envelope({ fileBytes: 5 * 1024 * 1024 });
  const { ticket } = await stage(input);
  const finalRequest = () => new NextRequest(`${origin}/api/applications`, {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ stagedUploadTicket: ticket }),
  });
  const first = await submitApplication(finalRequest());
  assert.equal(first.status, 201);
  const receipt = await first.json();
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].application.reference, receipt.reference);
  assert.equal(delivered[0].application.referralSource, "Facebook");
  assert.equal(delivered[0].application.id, `gs-${input.key}`);
  assert.deepEqual(Buffer.from(delivered[0].resume.base64, "base64"), pdf(5 * 1024 * 1024));
  assert.deepEqual(delivered[0].documents?.map(({ category }) => category), ["passport", "residence-id"]);
  for (const document of delivered[0].documents || []) assert.deepEqual(Buffer.from(document.base64, "base64"), pdf(5 * 1024 * 1024));
  const retried = await submitApplication(finalRequest());
  assert.equal(retried.status, 200);
  assert.deepEqual(await retried.json(), receipt);
  assert.equal(applications.size, 1);
  assert.equal(sessions.size, 1);
});

test("cached staged uploads with an autofilled legacy website restore and submit without refilling the form", async () => {
  const input = await envelope({ fileBytes: 1_200_000, legacyWebsite: "https://applicant.example" });
  assert.ok(input.bytes.length > 3_500_000);
  const { ticket } = await stage(input);
  const restored = await restoreStagedFormData(ticket);
  assert.equal(restored.get("website"), "https://applicant.example");
  assert.equal(restored.has("applicationCheck"), false, "Already-open forms lack the replacement trap");
  const finalRequest = () => new NextRequest(`${origin}/api/applications`, {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ stagedUploadTicket: ticket }),
  });
  const first = await submitApplication(finalRequest());
  assert.equal(first.status, 201);
  const receipt = await first.json();
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].application.reference, receipt.reference);
  assert.deepEqual(Buffer.from(delivered[0].resume.base64, "base64"), pdf(1_200_000));
  const retried = await submitApplication(finalRequest());
  assert.equal(retried.status, 200);
  assert.deepEqual(await retried.json(), receipt);
  assert.equal(applications.size, 1);
  assert.equal(sessions.size, 1);
});

test("a populated replacement application check in a staged envelope prevents final application delivery", async () => {
  const input = await envelope({ applicationChecks: ["", "spam"] });
  const { ticket } = await stage(input);
  const restored = await restoreStagedFormData(ticket);
  assert.deepEqual(restored.getAll("applicationCheck"), ["", "spam"]);
  const response = await submitApplication(new NextRequest(`${origin}/api/applications`, {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ stagedUploadTicket: ticket }),
  }));
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, "The application could not be accepted.");
  assert.equal(Object.hasOwn(body, "reference"), false);
  assert.equal(delivered.length, 0);
  assert.equal(applications.size, 0);
});

test("initialization validates structured answers, file metadata and required documents before touching Google", async () => {
  const input = await envelope();
  const invalid: unknown[] = [
    { ...input.start, submissionKey: "invalid-key" },
    { ...input.start, payload: { ...payload(), referralSource: "" } },
    { ...input.start, payload: { ...payload(), jobId: "retired-or-missing-job" } },
    { ...input.start, upload: { ...input.start.upload, sha256: "untrusted" } },
    { ...input.start, upload: { ...input.start.upload, totalBytes: MAX_STAGED_ENVELOPE_BYTES + 1 } },
    { ...input.start, upload: { ...input.start.upload, chunkCount: 2 } },
    { ...input.start, upload: { ...input.start.upload, contentType: "multipart/form-data; boundary=x\r\nInjected: value" } },
    { ...input.start, files: input.start.files.map((file) => file.field === "resume" ? { ...file, size: 5 * 1024 * 1024 + 1 } : file) },
    { ...input.start, files: input.start.files.map((file) => ({ ...file, size: 5 * 1024 * 1024 })).concat([{ field: "document:diploma", name: "extra.pdf", size: 1, type: "application/pdf" }]) },
    { ...input.start, files: input.start.files.filter(({ field }) => field !== "document:passport") },
    { ...input.start, files: input.start.files.concat([input.start.files[0]]) },
    { ...input.start, files: input.start.files.map((file) => file.field === "resume" ? { ...file, name: "resume.exe" } : file) },
    { ...input.start, files: input.start.files.map((file) => ({ ...file, type: "text/javascript" })) },
    { ...input.start, files: input.start.files.map((file) => ({ ...file, field: "arbitrary-file" })) },
    { ...input.start, unexpected: true },
  ];
  for (const start of invalid) await assert.rejects(initializeStagedUpload(start), StagedUploadError);
  assert.equal(operations.length, 0);
  const driver = [...proposedJobs, ...additionalApplicationJobs].find(({ title }) => /\bdrivers?\b/i.test(title))!;
  const driverInput = await envelope({ values: payload(driver.id) });
  await assert.rejects(initializeStagedUpload(driverInput.start), (error: unknown) => error instanceof StagedUploadError && Boolean(error.fieldErrors?.["document:driver-license"]));
  assert.equal(operations.length, 0);
});

test("ticket tampering, invalid indices, wrong part sizes and noncanonical base64 fail before Google receives bytes", async () => {
  const input = await envelope();
  const { ticket } = await initializeStagedUpload(input.start);
  const calls = operations.length;
  const [body, signature] = ticket.split(".");
  const decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  decoded.manifest.size++;
  const tampered = `${Buffer.from(JSON.stringify(decoded)).toString("base64url")}.${signature}`;
  for (const [value, index, base64] of [
    [tampered, 0, input.bytes.toString("base64")], [ticket, -1, input.bytes.toString("base64")],
    [ticket, 1, input.bytes.toString("base64")], [ticket, 0, "AA=="], [ticket, 0, input.bytes.toString("base64") + "\n"],
  ] as const) await assert.rejects(uploadStagedChunk(value, index, base64), StagedUploadError);
  assert.equal(operations.length, calls);
});

test("expired tickets and cross-protocol HMAC signatures cannot restore private chunks", async () => {
  const input = await envelope();
  const { ticket } = await stage(input);
  const calls = operations.length;
  const [body] = ticket.split(".");
  const wrongDomain = `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
  await assert.rejects(restoreStagedFormData(wrongDomain), StagedUploadError);
  const now = Date.now;
  Date.now = () => now() + 3600001;
  try { await assert.rejects(restoreStagedFormData(ticket), (error: unknown) => error instanceof StagedUploadError && error.code === "UPLOAD_STAGE_EXPIRED"); }
  finally { Date.now = now; }
  assert.equal(operations.length, calls);
});

test("full-envelope hashes, submission keys and normalized answers remain bound across staging and final restore", async () => {
  const corrupted = await envelope();
  const first = await stage(corrupted);
  const saved = sessions.get(first.uploadId)!;
  const bytes = Buffer.from(saved.chunks.get(0)!, "base64");
  bytes[bytes.length - 1] ^= 1;
  saved.chunks.set(0, bytes.toString("base64"));
  await assert.rejects(restoreStagedFormData(first.ticket), (error: unknown) => error instanceof StagedUploadError && error.code === "UPLOAD_STAGE_CONFLICT");

  const wrongKey = await envelope({ actualKey: randomUUID() });
  const second = await stage(wrongKey);
  await assert.rejects(restoreStagedFormData(second.ticket), (error: unknown) => error instanceof StagedUploadError && error.code === "UPLOAD_STAGE_CONFLICT");

  const changedAnswers = await envelope();
  changedAnswers.start.payload = { ...payload(), email: "different@example.test" };
  const third = await stage(changedAnswers);
  await assert.rejects(restoreStagedFormData(third.ticket), (error: unknown) => error instanceof StagedUploadError && error.code === "UPLOAD_STAGE_CONFLICT");
});

test("missing parts, receiver errors and mismatched acknowledgements never confirm an upload", async () => {
  const input = await envelope();
  const initialized = await initializeStagedUpload(input.start);
  await assert.rejects(restoreStagedFormData(initialized.ticket), (error: unknown) => error instanceof StagedUploadError && error.code === "UPLOAD_STAGE_NOT_FOUND");
  for (const code of ["UPLOAD_STAGE_EXPIRED", "UPLOAD_STAGE_CONFLICT", "UPLOAD_STAGE_RATE_LIMIT", "RECEIVER_ERROR"]) {
    replyOverride = () => Response.json({ ok: false, code, privateDetail: "Never expose Google internals" });
    await assert.rejects(uploadStagedChunk(initialized.ticket, 0, input.bytes.toString("base64")), (error: unknown) =>
      error instanceof StagedUploadError && !error.message.includes("privateDetail") && !error.message.includes("Google internals"));
  }
  replyOverride = () => Response.json({ ok: true, sessionId: randomUUID(), index: 0, size: input.bytes.length });
  await assert.rejects(uploadStagedChunk(initialized.ticket, 0, input.bytes.toString("base64")), StagedUploadError);
  replyOverride = () => new Response("Too large".repeat(MAX_STAGED_REQUEST_BYTES));
  await assert.rejects(uploadStagedChunk(initialized.ticket, 0, input.bytes.toString("base64")), StagedUploadError);
});

test("private parts can be retried after a lost chunk acknowledgement without changing their bytes", async () => {
  const input = await envelope();
  const { ticket, uploadId } = await initializeStagedUpload(input.start);
  const base64 = input.bytes.toString("base64");
  await uploadStagedChunk(ticket, 0, base64);
  const actual = sessions.get(uploadId)!.chunks;
  await uploadStagedChunk(ticket, 0, base64);
  assert.equal(actual.size, 1);
  assert.equal((await restoreStagedFormData(ticket)).get("idempotencyKey"), input.key);
});

test("lost start responses reserve no Google quota and a lost receiver initialization acknowledgement reuses one manifest", async () => {
  const input = await envelope();
  await initializeStagedUpload(input.start); // Model a start reply lost before reaching the browser.
  const initialized = await initializeStagedUpload(input.start);
  assert.equal(operations.length, 0);
  assert.equal(sessions.size, 0);
  let loseAcknowledgement = true;
  globalThis.fetch = async (url, init) => {
    const result = await receiver(url, init);
    const operation = JSON.parse(JSON.parse(String(init?.body)).payload);
    if (operation.operation === "upload-stage-init" && loseAcknowledgement) {
      loseAcknowledgement = false;
      throw new Error("Synthetic connection loss after the receiver reserved quota");
    }
    return result;
  };
  const base64 = input.bytes.toString("base64");
  await assert.rejects(uploadStagedChunk(initialized.ticket, 0, base64), StagedUploadError);
  assert.equal(sessions.size, 1);
  assert.equal(sessions.get(initialized.uploadId)!.chunks.size, 0);
  await uploadStagedChunk(initialized.ticket, 0, base64);
  assert.equal(sessions.size, 1);
  const initializations = operations.filter(({ operation }) => operation === "upload-stage-init");
  assert.equal(initializations.length, 2);
  assert.deepEqual(initializations[0].manifest, initializations[1].manifest);
  assert.equal((await restoreStagedFormData(initialized.ticket)).get("idempotencyKey"), input.key);
});

test("Google response redirects allow only the single-use Google content endpoint and never forward signed private bodies", async () => {
  const input = await envelope();
  const initialized = await initializeStagedUpload(input.start);
  for (const location of ["https://attacker.example/steal", "https://script.googleusercontent.com/wrong", "https://user:password@script.googleusercontent.com/macros/echo"]) {
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { location } });
    await assert.rejects(uploadStagedChunk(initialized.ticket, 0, input.bytes.toString("base64")), StagedUploadError);
  }
  let expectedSession = "";
  let pending: Record<string, unknown> = {};
  globalThis.fetch = async (url, init) => {
    if (String(url) === webhook) {
      pending = JSON.parse(JSON.parse(String(init?.body)).payload);
      expectedSession = pending.operation === "upload-stage-init" ? (pending.manifest as Record<string, unknown>).id as string : pending.sessionId as string;
      return new Response(null, { status: 302, headers: { location: "https://script.googleusercontent.com/macros/echo?token=synthetic" } });
    }
    assert.equal(String(url), "https://script.googleusercontent.com/macros/echo?token=synthetic");
    assert.equal(init?.method, "GET");
    assert.equal(init?.body, undefined);
    assert.equal(init?.redirect, "error");
    return pending.operation === "upload-stage-init" ? Response.json({ ok: true, sessionId: expectedSession })
      : Response.json({ ok: true, sessionId: expectedSession, index: pending.index, size: Buffer.from(String(pending.base64), "base64").length });
  };
  assert.equal((await uploadStagedChunk(initialized.ticket, 0, input.bytes.toString("base64"))).uploadId, expectedSession);
});

test("the upload route enforces origin, Google mode, JSON shape and bounded request bodies", async () => {
  const input = await envelope();
  const body = { action: "start", ...input.start };
  assert.equal((await uploadRoute(request(body, { origin: "https://other.example" }))).status, 403);
  assert.equal((await uploadRoute(request(body, { "content-type": "text/plain" }))).status, 400);
  assert.equal((await uploadRoute(request({ ...body, extra: true }))).status, 422);
  assert.equal((await uploadRoute(request({ action: "unknown" }))).status, 422);
  assert.equal((await uploadRoute(request({ action: "chunk", ticket: "bad", index: 0, base64: "x".repeat(MAX_STAGED_REQUEST_BYTES) }))).status, 413);
  process.env.APPLICATION_STORAGE = "database";
  try { assert.equal((await uploadRoute(request(body))).status, 404); }
  finally { process.env.APPLICATION_STORAGE = "google-sheets"; }
  assert.equal(operations.length, 0);
});

test("the upload route returns small acknowledgements while private bytes and Google IDs stay server-side", async () => {
  const input = await envelope();
  process.env.VERCEL = "1";
  const start = await uploadRoute(request({ action: "start", ...input.start }, { "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "198.51.100.8" }));
  delete process.env.VERCEL;
  assert.equal(start.status, 200);
  assert.equal(start.headers.get("cache-control"), "no-store");
  const initialized = await start.json();
  assert.deepEqual(Object.keys(initialized).sort(), ["chunkCount", "ticket", "uploadId"]);
  const chunk = await uploadRoute(request({ action: "chunk", ticket: initialized.ticket, index: 0, base64: input.bytes.toString("base64") }));
  assert.equal(chunk.status, 200);
  assert.deepEqual(Object.keys(await chunk.json()).sort(), ["bytes", "index", "sha256", "uploadId"]);
  const manifest = operations[0].manifest as Record<string, unknown>;
  assert.equal(manifest.clientKey, createHmac("sha256", secret).update("staged-upload-client-v1\0").update("203.0.113.9").digest("hex"));
  assert.equal((await restoreStagedFormData(initialized.ticket)).get("idempotencyKey"), input.key);
});
