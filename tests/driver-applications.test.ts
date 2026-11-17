import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { after, before, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { POST as submitDriverApplication } from "../app/api/driver-applications/route";
import { POST as submitApplication } from "../app/api/applications/route";
import { driverApplicationSchema, requiredDriverDocumentFields, meetsCzechRequirement } from "../lib/driver-applications";
import { saveDriverApplicationToGoogle } from "../lib/driver-application-storage";
import { initializeStagedUpload, StagedUploadError } from "../lib/staged-uploads";
import type { DriverSheetsPayload } from "../lib/sheets-transport";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const origin = "https://www.jobsincroatiaa.com";
const secret = "synthetic-driver-secret-".repeat(3);
const delivered: DriverSheetsPayload[] = [];
const nextYear = `${new Date().getUTCFullYear() + 1}-06-30`;

function answers(overrides: Record<string, unknown> = {}) {
  return {
    form: "driver-v1", variant: "czech-licence-check", jobId: "job-order-trailer-driver",
    firstName: "Synthetic", lastName: "Driver", email: "driver@example.test", phone: "+63 917 123 4567", telegram: "",
    dateOfBirth: "1985-03-14", currentCountry: "Philippines", currentLocation: "Quezon City, Metro Manila",
    destinationCountry: "Czech Republic", licenseCategories: ["CE", "B", "C"], licenseExpiry: nextYear,
    drivingExperienceYears: 8, hasIdp: "Yes", idpExpiry: nextYear, shareWithTendaDom: true,
    englishProficiency: "Yes", referralSource: "Facebook", termsAccepted: true, consent: true, ...overrides,
  };
}
function pdf(label: string) {
  return new File([Buffer.from(`%PDF-1.4\n${label}\n%%EOF\n`)], `${label}.pdf`, { type: "application/pdf" });
}
function form(values: unknown, files: Record<string, File>, key = randomUUID()) {
  const body = new FormData();
  body.set("payload", JSON.stringify(values));
  body.set("idempotencyKey", key);
  body.set("applicationCheck", "");
  for (const [field, file] of Object.entries(files)) body.set(field, file);
  return body;
}
function request(body: FormData, url = `${origin}/api/driver-applications`) {
  return new NextRequest(url, { method: "POST", body, headers: { origin } });
}

before(() => {
  Object.assign(process.env, {
    APPLICATION_STORAGE: "google-sheets", CHAPTER_LOCAL_MODE: "false", APP_ORIGIN: origin,
    GOOGLE_SHEETS_WEBHOOK_URL: "https://script.google.com/macros/s/test-driver-receiver/exec", GOOGLE_SHEETS_WEBHOOK_SECRET: secret,
  });
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const envelope = JSON.parse(String(init.body));
    assert.equal(envelope.signature, createHmac("sha256", secret).update(`${envelope.timestamp}.${envelope.payload}`).digest("hex"));
    const payload = JSON.parse(envelope.payload) as DriverSheetsPayload;
    delivered.push(payload);
    return new Response(JSON.stringify({ ok: true, applicationId: payload.application.id, reference: payload.application.reference, row: 2, duplicate: false }), { status: 200 });
  }) as typeof fetch;
});
beforeEach(() => { delivered.length = 0; });
after(() => { process.env = originalEnv; globalThis.fetch = originalFetch; });

test("the Czech licence check requires C, CE, an IDP and consent to share with Tenda Dom", () => {
  const valid = driverApplicationSchema.parse(answers());
  assert.deepEqual(valid.licenseCategories, ["B", "C", "CE"]);
  assert.ok(meetsCzechRequirement(valid));
  const issues = (overrides: Record<string, unknown>) => {
    const result = driverApplicationSchema.safeParse(answers(overrides));
    return result.success ? [] : result.error.issues.map(({ path }) => path.join("."));
  };
  assert.deepEqual(issues({ licenseCategories: ["B", "C"], shareWithTendaDom: false }), ["licenseCategories", "shareWithTendaDom"]);
  assert.deepEqual(issues({ hasIdp: "No", idpExpiry: "" }), ["hasIdp", "shareWithTendaDom"]);
  assert.deepEqual(issues({ idpExpiry: "2020-01-01" }), ["idpExpiry"]);
  assert.deepEqual(issues({ licenseExpiry: "2020-01-01" }), ["licenseExpiry"]);
  assert.deepEqual(issues({ unexpected: "field" }), [""]);
});

test("the general driver form accepts drivers without CE or an IDP, but never shares their documents", () => {
  const driver = answers({ variant: "driver", licenseCategories: ["B", "C"], hasIdp: "No", idpExpiry: "", shareWithTendaDom: false, destinationCountry: "Croatia" });
  assert.ok(driverApplicationSchema.safeParse(driver).success);
  assert.equal(driverApplicationSchema.safeParse({ ...driver, shareWithTendaDom: true }).success, false);
  assert.deepEqual(requiredDriverDocumentFields({ variant: "driver", shareWithTendaDom: false, hasIdp: "No" }), ["document:license-front", "document:license-back"]);
  assert.deepEqual(requiredDriverDocumentFields({ variant: "driver", shareWithTendaDom: false, hasIdp: "Yes" }), ["document:license-front", "document:license-back", "document:idp-1"]);
  assert.deepEqual(requiredDriverDocumentFields({ variant: "czech-licence-check", shareWithTendaDom: true, hasIdp: "Yes" }), ["document:license-front", "document:license-back", "document:idp-1"]);
});

test("driver submissions are signed to the receiver with licence, IDP and CV files in their own categories", async () => {
  const response = await submitDriverApplication(request(form(answers(), {
    "document:license-front": pdf("front"), "document:license-back": pdf("back"),
    "document:idp-1": pdf("idp-1"), "document:idp-2": pdf("idp-2"), resume: pdf("cv"),
  })));
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.match(body.reference, /^DR-[A-F0-9]{24}$/);
  assert.equal(body.jobTitle, "Trailer Driver");
  assert.equal(delivered.length, 1);
  const [payload] = delivered;
  assert.equal(payload.kind, "driver-application");
  assert.equal(payload.application.form, "Czech licence check (Tenda Dom)");
  assert.equal(payload.application.licenseCategories, "B, C, CE");
  assert.equal(payload.application.meetsCzechRequirement, "Yes");
  assert.equal(payload.application.shareWithTendaDom, "Yes");
  assert.deepEqual(payload.documents.map(({ category }) => category).sort(), ["cv", "idp-1", "idp-2", "license-back", "license-front"]);
  assert.ok(payload.documents.every(({ id, category }) => id === `${payload.application.id}-${category}`));
});

test("the driver route rejects missing documents, gaps in IDP pages, non-driver roles and unknown files", async () => {
  const files = { "document:license-front": pdf("front"), "document:license-back": pdf("back"), "document:idp-1": pdf("idp") };
  let response = await submitDriverApplication(request(form(answers(), { "document:license-front": pdf("front"), "document:idp-1": pdf("idp") })));
  assert.equal(response.status, 422);
  assert.ok((await response.json()).fieldErrors["document:license-back"]);
  response = await submitDriverApplication(request(form(answers(), { ...files, "document:idp-3": pdf("idp-3") })));
  assert.equal(response.status, 422);
  assert.ok((await response.json()).fieldErrors["document:idp-1"]);
  response = await submitDriverApplication(request(form(answers({ variant: "driver", jobId: "proposed-fabricator-01", shareWithTendaDom: false }), files)));
  assert.equal(response.status, 409);
  response = await submitDriverApplication(request(form(answers(), { ...files, "document:passport": pdf("passport") })));
  assert.equal(response.status, 422);
  assert.equal(delivered.length, 0);
});

test("driver payloads cannot be submitted through the general application route", async () => {
  const response = await submitApplication(request(form(answers(), { resume: pdf("cv") }), `${origin}/api/applications`));
  assert.equal(response.status, 422);
  assert.equal(delivered.length, 0);
});

test("large driver uploads can be staged, but only with the driver file fields", async () => {
  const start = (files: { field: string; name: string; size: number; type: string }[]) => initializeStagedUpload({
    payload: answers(), submissionKey: randomUUID(), files,
    upload: { sha256: "a".repeat(64), totalBytes: 5_000_000, chunkCount: 3, contentType: "multipart/form-data; boundary=driverBoundary" },
  });
  const file = (field: string) => ({ field, name: `${field.replace(":", "-")}.jpg`, size: 900_000, type: "image/jpeg" });
  const staged = await start([file("document:license-front"), file("document:license-back"), file("document:idp-1"), file("document:idp-2")]);
  assert.equal(staged.chunkCount, 3);
  await assert.rejects(start([file("document:license-front"), file("document:idp-1")]), (error: unknown) =>
    error instanceof StagedUploadError && Boolean(error.fieldErrors?.["document:license-back"]));
  await assert.rejects(start([file("document:license-front"), file("document:license-back"), file("document:idp-1"), file("document:passport")]), StagedUploadError);
});

test("a mismatched receiver acknowledgement never confirms a driver application", async () => {
  const input = driverApplicationSchema.parse(answers());
  await assert.rejects(saveDriverApplicationToGoogle(input, { id: "job-order-trailer-driver", title: "Trailer Driver" }, randomUUID(), "f".repeat(64), [],
    async (payload) => ({ ok: true, applicationId: payload.application.id, reference: "DR-WRONG", row: 2, duplicate: false })), /INVALID_APPLICATION_ACKNOWLEDGEMENT/);
});

test("the receiver writes driver applications to their own tab, with private file links, and deduplicates retries", () => {
  const source = readFileSync(new URL("../integrations/google-sheets/Code.gs", import.meta.url), "utf8");
  const receiverSecret = "receiver-driver-test-secret-".repeat(3);
  const folderId = "private-test-folder-id";
  const tabs = new Map<string, { rows: unknown[][]; maxColumns: number; frozen: number }>();
  const files: Record<string, unknown>[] = [];
  let staged: Record<string, unknown> | undefined;
  const sheetHandle = (name: string) => {
    const tab = tabs.get(name)!;
    return {
      getLastRow: () => tab.rows.length, getLastColumn: () => Math.max(0, ...tab.rows.map((row) => row.length)),
      getMaxRows: () => 1000, getMaxColumns: () => tab.maxColumns, setFrozenRows: (count: number) => { tab.frozen = count; },
      insertColumnsAfter: (_after: number, count: number) => { tab.maxColumns += count; },
      getRange: (row: number, column: number, count = 1, columns = 1) => ({
        getValues: () => Array.from({ length: count }, (_, index) => Array.from({ length: columns }, (_, offset) => tab.rows[row - 1 + index]?.[column - 1 + offset] ?? "")),
        setValues: (values: unknown[][]) => values.forEach((cells, index) => { tab.rows[row - 1 + index] = [...cells]; }),
        setFontWeight: () => undefined,
      }),
    };
  };
  const spreadsheet = {
    getSheetByName: (name: string) => tabs.has(name) ? sheetHandle(name) : null,
    insertSheet: (name: string) => { tabs.set(name, { rows: [], maxColumns: 26, frozen: 0 }); return sheetHandle(name); },
  };
  tabs.set("Applications", { rows: [["untouched"]], maxColumns: 36, frozen: 1 });
  const reply = (data: unknown, headers = {}) => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(data), getAllHeaders: () => headers });
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => ({ CHAPTER_WEBHOOK_SECRET: receiverSecret, CHAPTER_CV_FOLDER_ID: folderId } as Record<string, string>)[key] ?? null }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (text: string) => ({ setMimeType: () => JSON.parse(text) }) },
    Utilities: {
      Charset: { UTF_8: "utf8" }, base64Decode: (value: string) => [...Buffer.from(value, "base64")], newBlob: (bytes: number[]) => Buffer.from(bytes),
      computeHmacSha256Signature: (value: string, key: string) => [...createHmac("sha256", key).update(value).digest()],
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => undefined }) },
    SpreadsheetApp: { openById: () => spreadsheet },
    ScriptApp: { getOAuthToken: () => "token" },
    UrlFetchApp: { fetch: (url: string, options: Record<string, unknown>) => {
      if (url.includes("/permissions?")) return reply({ permissions: [{ type: "user", role: "owner" }] });
      if (url.includes(`/files/${folderId}?`)) return reply({ id: folderId, mimeType: "application/vnd.google-apps.folder", trashed: false });
      if (url.includes("/drive/v3/files?q=")) {
        const applicationId = /value='([^']+)'/.exec(decodeURIComponent(url))?.[1];
        return reply({ files: files.filter((file) => (file.appProperties as Record<string, string>).chapterApplicationId === applicationId) });
      }
      if (url.includes("uploadType=resumable")) { staged = JSON.parse(String(options.payload)); return reply({}, { Location: "https://www.googleapis.com/upload/drive/v3/files?upload_id=mock" }); }
      if (url.includes("upload_id=mock")) {
        const file = { ...staged, id: `private-file-${files.length + 1}`, size: String((options.payload as Buffer).length), trashed: false };
        files.push(file);
        return reply(file);
      }
      const values = /\/values\/'Driver Applications'!A(\d+):AD(\d+)\?valueInputOption=RAW$/.exec(decodeURIComponent(url));
      if (values) {
        const row = JSON.parse(String(options.payload)).values[0];
        tabs.get("Driver Applications")!.rows[Number(values[1]) - 1] = row;
        return reply({ updatedRows: 1, updatedColumns: row.length, updatedRange: `'Driver Applications'!A${values[1]}:AD${values[1]}` });
      }
      throw new Error(`Unexpected Google request ${url}`);
    } },
  });
  vm.runInContext(source, context);
  const id = `dr-${randomUUID()}`;
  const document = (category: string) => ({ id: `${id}-${category}`, category, name: `${category}.pdf`, mime: "application/pdf", base64: Buffer.from("%PDF-1.4\nx\n%%EOF").toString("base64") });
  const payload = {
    kind: "driver-application", version: 1,
    application: {
      id, reference: "DR-0123456789ABCDEF01234567", submittedAt: new Date().toISOString(), form: "Czech licence check (Tenda Dom)",
      jobId: "job-order-trailer-driver", jobTitle: "Trailer Driver", firstName: "=SUM(1,1)", lastName: "Driver", fullName: "=SUM(1,1) Driver",
      email: "driver@example.test", phone: "+63 917 123 4567", telegram: "", dateOfBirth: "1985-03-14", currentCountry: "Philippines",
      currentLocation: "Quezon City", destinationCountry: "Czech Republic", licenseCategories: "B, C, CE", licenseExpiry: nextYear,
      drivingExperienceYears: 8, hasIdp: "Yes", idpExpiry: nextYear, meetsCzechRequirement: "Yes", shareWithTendaDom: "Yes",
      englishProficiency: "Yes", referralSource: "Facebook", termsAccepted: true, consent: true, applicationSource: "Jobs in Croatia",
    },
    documents: ["license-front", "license-back", "idp-1", "idp-2"].map(document),
  };
  const post = (body: unknown) => {
    const timestamp = Date.now();
    const serialized = JSON.stringify(body);
    context.event = { postData: { contents: JSON.stringify({ timestamp, payload: serialized, signature: createHmac("sha256", receiverSecret).update(`${timestamp}.${serialized}`).digest("hex") }) } };
    return vm.runInContext("doPost(event)", context) as Record<string, unknown>;
  };
  const first = post(payload);
  assert.deepEqual(first, { ok: true, applicationId: id, reference: payload.application.reference, row: 2, duplicate: false });
  const tab = tabs.get("Driver Applications")!;
  assert.deepEqual(tab.rows[0], [...vm.runInContext("CHAPTER_DRIVER_HEADERS", context)]);
  assert.equal(tab.rows[0].length, 30);
  assert.equal(tab.frozen, 1);
  const row = tab.rows[1];
  assert.equal(row[5], "=SUM(1,1)"); // written RAW, never as a formula
  assert.equal(row[15], "B, C, CE");
  assert.equal(row[20], "Yes");
  assert.match(String(row[22]), /^https:\/\/drive\.google\.com\/file\/d\/private-file-\d\/view$/);
  assert.equal(String(row[24]).split("\n").length, 2);
  assert.equal(row[25], "");
  assert.deepEqual(tabs.get("Applications")!.rows, [["untouched"]]);
  assert.deepEqual(post(payload), { ...first, duplicate: true });
  assert.equal(files.length, 4);
  assert.equal(tab.rows.length, 2);
  assert.deepEqual(post({ ...payload, documents: payload.documents.filter(({ category }) => category !== "license-back") }), { ok: false, code: "INVALID_DOCUMENT" });
  assert.deepEqual(post({ ...payload, documents: [...payload.documents, document("passport")] }), { ok: false, code: "INVALID_DOCUMENT" });
});
