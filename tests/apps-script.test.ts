import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import vm from "node:vm";
import { test } from "node:test";
import { buildSheetsPayload } from "../lib/sheets-transport";
import type { Application } from "../lib/types";

const source = readFileSync(new URL("../integrations/google-sheets/Code.gs", import.meta.url), "utf8");
const secret = "receiver-unit-test-secret-".repeat(3);
const folderId = "private-test-folder-id";
type DriveFile = { id: string; name: string; mimeType: string; size: string; trashed: boolean;
  parents: string[]; appProperties: Record<string, string>; };

function fixture() {
  const properties = new Map([
    ["CHAPTER_WEBHOOK_SECRET", secret], ["CHAPTER_CV_FOLDER_ID", folderId],
    ["CHAPTER_SHEET_NAME", "Applications"],
  ]);
  const state = {
    rows: [] as unknown[][], files: [] as DriveFile[], calls: [] as { url: string; options: Record<string, unknown> }[],
    writeFailures: 0, maxRows: 1000, maxColumns: 30, folderPublic: false, filePublic: false, locks: 0, releases: 0,
    stagedFile: undefined as Omit<DriveFile, "id" | "size" | "trashed"> | undefined,
  };
  const response = (data: unknown, status = 200, headers = {}) => ({
    getResponseCode: () => status, getContentText: () => JSON.stringify(data), getAllHeaders: () => headers,
  });
  const sheet = {
    getLastRow: () => state.rows.length,
    getMaxRows: () => state.maxRows,
    getMaxColumns: () => state.maxColumns,
    deleteColumns: (column: number, count: number) => {
      state.rows.forEach((row) => row.splice(column - 1, count)); state.maxColumns -= count;
    },
    insertRowsAfter: (after: number, count: number) => { assert.equal(after, state.maxRows); state.maxRows += count; },
    insertColumnsAfter: (after: number, count: number) => { assert.equal(after, state.maxColumns); state.maxColumns += count; },
    getLastColumn: () => Math.max(0, ...state.rows.map((row) => row.length)),
    getRange: (row: number, column: number, count = 1, columns = 1) => ({
      getValues: () => Array.from({ length: count }, (_, index) =>
        Array.from({ length: columns }, (_, offset) => state.rows[row - 1 + index]?.[column - 1 + offset] ?? "")),
      getValue: () => state.rows[row - 1]?.[column - 1] ?? "",
      setValues: (values: unknown[][]) => {
        values.forEach((cells, index) => {
          const target = state.rows[row - 1 + index] ??= [];
          cells.forEach((value, offset) => { target[column - 1 + offset] = value; });
        });
      },
    }),
  };
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key: string) => properties.get(key) ?? null,
      setProperty: (key: string, value: string) => properties.set(key, value),
    }) },
    ContentService: { MimeType: { JSON: "application/json" }, createTextOutput: (text: string) => ({
      setMimeType: () => JSON.parse(text),
    }) },
    Utilities: {
      Charset: { UTF_8: "utf8" },
      computeHmacSha256Signature: (value: string, key: string) => [...createHmac("sha256", key).update(value).digest()],
      base64Decode: (value: string) => [...Buffer.from(value, "base64")],
      newBlob: (bytes: number[]) => Buffer.from(bytes),
    },
    LockService: { getScriptLock: () => ({
      tryLock: () => { state.locks++; return true; }, releaseLock: () => { state.releases++; },
    }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }) },
    ScriptApp: { getOAuthToken: () => "mock-google-access-token" },
    UrlFetchApp: { fetch: (url: string, options: Record<string, unknown>) => {
      state.calls.push({ url, options });
      assert.equal((options.headers as Record<string, unknown>).Authorization, "Bearer mock-google-access-token");
      assert.equal(options.followRedirects, false);
      if (url.includes("/permissions?")) return response({ permissions: [
        { type: "user", role: "owner" },
        ...(url.includes(folderId) && state.folderPublic || !url.includes(folderId) && state.filePublic
          ? [{ type: "anyone", role: "reader" }] : []),
      ] });
      if (url.includes("/files/" + folderId + "?")) return response({
        id: folderId, mimeType: "application/vnd.google-apps.folder", trashed: false,
      });
      if (url.includes("/drive/v3/files?q=")) {
        const query = decodeURIComponent(url);
        const applicationId = /key='chapterApplicationId' and value='([^']+)'/.exec(query)?.[1];
        const documentId = /key='chapterDocumentId' and value='([^']+)'/.exec(query)?.[1];
        assert.ok(!/has\s*\{\s*key='[^']+'\s*\}/.test(query), "Drive property searches require key and value");
        return response({ files: state.files.filter((file) => file.appProperties.chapterApplicationId === applicationId &&
          (!documentId || file.appProperties.chapterDocumentId === documentId)) });
      }
      if (url.includes("uploadType=resumable")) {
        state.stagedFile = JSON.parse(options.payload as string);
        return response({}, 200, { Location: "https://www.googleapis.com/upload/drive/v3/files?upload_id=mock" });
      }
      if (url.includes("upload_id=mock")) {
        assert.ok(Buffer.isBuffer(options.payload));
        const file = { ...state.stagedFile!, id: "private-cv-" + (state.files.length + 1),
          size: String((options.payload as Buffer).length), trashed: false };
        state.files.push(file);
        return response(file);
      }
      if (url.includes("/values/")) {
        assert.equal(options.method, "put");
        assert.match(decodeURIComponent(url), new RegExp("/values/'Applications'!A" + (state.rows.length + 1) + ":AD" + (state.rows.length + 1) + "\\?valueInputOption=RAW$"));
        if (state.writeFailures-- > 0) return response({ error: "Private Google failure detail" }, 503);
        const row = JSON.parse(options.payload as string).values[0];
        assert.equal(row.length, 30);
        state.rows.push(row);
        return response({ updatedRows: 1, updatedColumns: 30, updatedRange: "'Applications'!A" + state.rows.length + ":AD" + state.rows.length });
      }
      const file = state.files.find((item) => url.includes("/files/" + item.id + "?"));
      if (file) return response(file);
      throw new Error("Unexpected Google request: " + url);
    } },
  });
  vm.runInContext(source, context);
  state.rows.push([...vm.runInContext("CHAPTER_HEADERS", context)]);
  function post(payload: unknown = application(), overrides: Record<string, unknown> = {}) {
    const timestamp = Date.now();
    const serialized = JSON.stringify(payload);
    const signature = createHmac("sha256", secret).update(`${timestamp}.${serialized}`).digest("hex");
    context.event = { postData: { contents: JSON.stringify({ timestamp, payload: serialized, signature, ...overrides }) } };
    return vm.runInContext("doPost(event)", context) as {
      ok: boolean; code?: string; duplicate?: boolean; applicationId?: string; reference?: string; row?: number;
    };
  }
  return { state, post, context, properties };
}

function application() {
  return {
    version: 1,
    application: {
      id: "69e88566-3117-4b32-9540-f3a66c1b1f45", reference: "CH-2026-ABCDEF0123456789",
      submittedAt: "2026-10-15T08:00:00.000Z", jobTitle: "Fabricator", jobId: "proposed-fabricator-01",
      status: "New", fullName: "=SUM(1,1)", email: "applicant@example.test", phone: "+63 917 123 4567",
      country: "Philippines", recentJobTitle: "Fabricator", experienceYears: 2, skills: "=HYPERLINK(\"https://example.test\")",
      education: "High school", summary: "", coverLetter: "", consent: true,
      nc2Certificate: "NC2 Fabricator", documentReadiness: { nc2: "ready", diploma: "ready", nbi: "in-progress", form18a: "not-yet" },
      preferredEmployer: "Končar MK", expectedNc2: "NC2 Fabricator", employers: [{ name: "Končar MK", workers: 5 }],
    },
    resume: { name: "CV.pdf", mime: "application/pdf", base64: Buffer.from("%PDF-1.4\nTest CV\n%%EOF").toString("base64") },
  };
}

test("Apps Script signed delivery writes RAW recruiter columns and retry deduplicates row and private CV", () => {
  const { state, post } = fixture();
  assert.deepEqual(post(), { ok: true, applicationId: application().application.id,
    reference: application().application.reference, row: 2, duplicate: false,
    cvUrl: "https://drive.google.com/file/d/private-cv-1/view" });
  assert.equal(state.rows[1][2], "=SUM(1,1)");
  assert.equal(state.rows[1][4], "+63 917 123 4567");
  assert.equal(state.rows[1][14], application().application.skills);
  assert.equal(state.rows[1][17], application().application.education);
  assert.equal(state.rows[1][21], "Yes");
  assert.ok(!state.rows[0].some((header) => /^(NC2|Diploma|NBI\/apostille|Form 18a) status$/.test(String(header))));
  assert.equal(post().duplicate, true);
  assert.equal(state.rows.length, 2);
  assert.equal(state.files.length, 1);
  assert.equal(state.locks, state.releases);
  assert.ok(state.calls.every(({ url }) => !url.includes("permissions.create")));
});

test("Apps Script rejects tampered signatures and expired envelopes before Google access", () => {
  const { state, post } = fixture();
  assert.equal(post(application(), { signature: "0".repeat(64) }).code, "INVALID_SIGNATURE");
  assert.equal(post(application(), { timestamp: Date.now() - 6 * 60 * 1000 }).code, "EXPIRED_REQUEST");
  assert.equal(state.calls.length, 0);
  assert.equal(state.locks, 0);
});

test("Apps Script validates strict payload, readiness and CV signatures before storage", () => {
  const { state, post } = fixture();
  const extraField = { ...application(), unexpected: "field" };
  assert.equal(post(extraField).code, "INVALID_SCHEMA");
  const missingCertificate = application();
  missingCertificate.application.nc2Certificate = "";
  assert.equal(post(missingCertificate).code, "INVALID_APPLICATION");
  const wrongBytes = application();
  wrongBytes.resume.base64 = Buffer.from("Not a PDF").toString("base64");
  assert.equal(post(wrongBytes).code, "INVALID_CV");
  const pathName = application();
  pathName.resume.name = "../CV.pdf";
  assert.equal(post(pathName).code, "INVALID_CV");
  const malformed = application();
  malformed.resume.base64 = "%%%";
  assert.equal(post(malformed).code, "INVALID_CV");
  const tooLarge = application();
  tooLarge.resume.base64 = Buffer.alloc(5 * 1024 * 1024 + 1, 1).toString("base64");
  assert.equal(post(tooLarge).code, "INVALID_CV");
  assert.equal(state.calls.length, 0);
});

test("Apps Script reuses uploaded CV after failed sheet write and returns sanitized errors", () => {
  const { state, post } = fixture();
  state.writeFailures = 1;
  assert.deepEqual(post(), { ok: false, code: "SHEET_WRITE_FAILED" });
  assert.equal(state.files.length, 1);
  assert.equal(state.rows.length, 1);
  assert.equal(post().ok, true);
  assert.equal(state.files.length, 1);
  assert.equal(state.rows.length, 2);
});

test("Apps Script writes fixed A:AD coordinates without append table detection and expands a full sheet", () => {
  const { state, post } = fixture();
  state.maxRows = 1;
  assert.equal(post().ok, true);
  assert.equal(state.maxRows, 101);
  assert.equal(state.rows[1][0], application().application.id);
  assert.equal(state.rows[1][21], "Yes");
  const write = state.calls.find(({ url }) => url.includes("/values/"));
  assert.ok(write);
  assert.match(decodeURIComponent(write.url), /'Applications'!A2:AD2\?valueInputOption=RAW$/);
  assert.ok(!write.url.includes(":append"));
});

test("Apps Script stops on changed headers, conflicting references, or public CV folders", () => {
  const altered = fixture();
  altered.state.rows[0][2] = "Unrelated data";
  assert.equal(altered.post().code, "HEADER_MISMATCH");
  assert.equal(altered.state.calls.length, 0);
  const conflict = fixture();
  conflict.state.rows.push(["other-id", application().application.reference]);
  assert.equal(conflict.post().code, "DUPLICATE_CONFLICT");
  assert.equal(conflict.state.files.length, 0);
  const publicFolder = fixture();
  publicFolder.state.folderPublic = true;
  assert.equal(publicFolder.post().code, "CV_NOT_PRIVATE");
  assert.equal(publicFolder.state.files.length, 0);
  const publicFile = fixture();
  publicFile.state.filePublic = true;
  assert.equal(publicFile.post().code, "CV_NOT_PRIVATE");
  assert.equal(publicFile.state.rows.length, 1);
});

test("Apps Script health endpoint has no applicant data or secret", () => {
  const { context, properties } = fixture();
  properties.clear();
  assert.deepEqual(vm.runInContext("doGet()", context), { ok: true, service: "chapter-applications", version: 1, schemaVersion: 4, columns: 30 });
});

test("referral sources append after every existing recruiter column and legacy payloads leave AD blank", () => {
  const legacy = fixture();
  assert.equal(legacy.post().ok, true);
  assert.equal(legacy.state.rows[0][29], "Where did you hear about us?");
  assert.equal(legacy.state.rows[1][29], "");
  assert.equal(legacy.post().duplicate, true);
  for (const referralSource of ["Facebook", "TikTok", "Instagram", "Reddit", "YouTube", "Google Search", "Friend or family", "Other", ""]) {
    const { state, post } = fixture();
    const original = application();
    assert.equal(post({ ...original, application: { ...original.application, referralSource } }).ok, true);
    assert.deepEqual(state.rows[1].slice(0, 29), legacy.state.rows[1].slice(0, 29));
    assert.equal(state.rows[1][29], referralSource);
  }
});

test("complete website payload writes a literal referral answer through signed delivery without interpreting formula text", () => {
  const { state, post } = fixture();
  const original = application();
  const payload = buildSheetsPayload({
    ...original.application, preferredEmployer: "", referralSource: "Google Search",
    resumeKey: "private/resume.pdf", resumeName: original.resume.name, resumeMime: original.resume.mime, isExample: false,
  } as Application, Buffer.from(original.resume.base64, "base64"));
  assert.equal(post(payload).ok, true);
  assert.equal(state.rows[1][29], "Google Search");
  assert.equal(state.rows[1][2], "=SUM(1,1)");
  assert.equal(state.rows[1][14], original.application.skills);
  assert.equal(state.rows[1][4], original.application.phone);
  const write = state.calls.find(({ url }) => url.includes("/values/"));
  assert.match(decodeURIComponent(write!.url), /valueInputOption=RAW$/);
  assert.equal(post(payload).duplicate, true);
  assert.equal(state.rows.length, 2);
});

test("reference profile answers and private identity filenames deliver through the updated receiver without new columns or duplicate categories", () => {
  const { state, post } = fixture();
  const original = application();
  const documents = ["passport", "residence-id", "employment-certificate", "diploma"].map((category) => ({
    id: `${category}-id`, category, name: `${category}.pdf`, key: `private/${category}.pdf`, mime: original.resume.mime,
    size: Buffer.from(original.resume.base64, "base64").length,
  })) as NonNullable<Application["documents"]>;
  const record: Application = {
    ...original.application, preferredEmployer: "", resumeKey: "private/resume.pdf", resumeName: original.resume.name,
    resumeMime: original.resume.mime, isExample: false, fullName: "Test Applicant", recentJobTitle: "", experienceYears: null, skills: "",
    profile: { firstName: "Test", lastName: "Applicant", gender: "Male", nationality: "Filipino", address: "17 Sample Street, Manila, Metro Manila, 0017",
      street: "17 Sample Street", city: "Manila", province: "Metro Manila", postalCode: "0017",
      dateOfBirth: "1990-01-01", placeOfBirth: "Manila", destinationCountry: "Croatia", currentWorkCountry: "Philippines",
      secondaryJobTitle: "Welder", englishProficiency: "No", termsAccepted: true }, documents,
  } as Application;
  const payload = buildSheetsPayload(record, Buffer.from(original.resume.base64, "base64"), undefined,
    documents.map(({ key: _key, size: _size, ...document }) => { void _key; void _size; return { ...document, base64: original.resume.base64 }; }));
  assert.equal("profile" in payload.application, false);
  assert.deepEqual(payload.documents?.map(({ category }) => category), ["diploma"]);
  assert.equal(post(payload).ok, true);
  assert.equal(state.rows[0].length, 30);
  assert.equal(state.rows[1].length, 30);
  assert.equal(state.rows[1][12], "");
  assert.equal(state.rows[1][13], "");
  assert.equal(state.rows[1][14], "");
  assert.match(String(state.rows[1][18]), /reference form does not collect/);
  assert.match(String(state.rows[1][18]), /First name: Test/);
  assert.match(String(state.rows[1][18]), /Street: 17 Sample Street\nCity: Manila\nProvince: Metro Manila\nPostal code: 0017/);
  assert.match(String(state.rows[1][18]), /Speaks and understands English: No/);
  assert.match(String(state.rows[1][18]), /Passport: passport.pdf/);
  assert.match(String(state.rows[1][18]), /Residence ID: residence-id.pdf/);
  assert.match(String(state.rows[1][18]), /Certificate of employment: employment-certificate.pdf/);
  assert.equal(state.files.length, 2); // Only the CV and the existing diploma category go to Drive.
  assert.equal(post(payload).duplicate, true);
  assert.equal(state.rows.length, 2);
});

test("receiver accepts unknown years as null and leaves the sheet cell blank while rejecting string sentinels", () => {
  const original = application();
  const { post, state } = fixture();
  for (const experienceYears of ["", "Not collected", "0", -1, 61])
    assert.equal(post({ ...original, application: { ...original.application, experienceYears } }).code, "INVALID_APPLICATION");
  assert.equal(state.files.length, 0);
  const payload = { ...original, application: { ...original.application, experienceYears: null, recentJobTitle: "", skills: "" } };
  assert.equal(post(payload).ok, true);
  assert.equal(state.rows[1][12], "");
  assert.equal(state.rows[1][13], "");
  assert.equal(state.rows[1][14], "");
  assert.equal(post(payload).duplicate, true);
});

test("receiver rejects invalid and formula-like referral answers before storing files or rows", () => {
  for (const referralSource of ["=HYPERLINK(\"https://example.test\")", "+Facebook", "Unknown source", "Facebook\n", 1, null, []]) {
    const { state, post } = fixture();
    const original = application();
    assert.equal(post({ ...original, application: { ...original.application, referralSource } }).code, "INVALID_APPLICATION");
    assert.equal(state.calls.length, 0);
    assert.equal(state.rows.length, 1);
  }
});

test("owner setup appends the referral header to a 29-column sheet without changing existing answers or links", () => {
  const { state, post, context } = fixture();
  state.rows[0] = state.rows[0].slice(0, 29);
  state.maxColumns = 29;
  const oldRow = state.rows[0].map((_, index) => "existing-cell-" + index);
  state.rows.push([...oldRow]);
  assert.equal(post().code, "HEADER_MISMATCH");
  assert.equal(state.calls.length, 0);
  assert.deepEqual({ ...vm.runInContext("setupChapterSync()", context) }, {
    ok: true, sheetName: "Applications", cvFolderUrl: "https://drive.google.com/drive/folders/" + folderId,
  });
  assert.equal(state.maxColumns, 30);
  assert.equal(state.rows[0][29], "Where did you hear about us?");
  assert.deepEqual(state.rows[1], oldRow);
  vm.runInContext("setupChapterSync()", context);
  assert.deepEqual(state.rows[1], oldRow);
  assert.equal(post().ok, true);
  assert.equal(state.rows[2][29], "");
});

test("referral header migration refuses to overwrite an unrelated existing AD column", () => {
  const { state, context } = fixture();
  state.rows[0][29] = "Staff notes";
  const before = state.rows[0].slice();
  assert.throws(() => vm.runInContext("setupChapterSync()", context), /HEADER_MISMATCH/);
  assert.deepEqual(state.rows[0], before);
  assert.equal(state.calls.length, 0);
});

test("Apps Script delivers diploma and other supporting files privately and retries without duplicates", () => {
  const { state, post } = fixture();
  const original = application();
  const payload = { ...original, version: 2, documents: [
    { ...original.resume, id: "diploma-id", category: "diploma", name: "diploma.pdf" },
    { ...original.resume, id: "other-id", category: "other", name: "training.pdf" },
  ] };
  state.writeFailures = 1;
  assert.equal(post(payload).code, "SHEET_WRITE_FAILED");
  assert.equal(state.files.length, 3);
  assert.equal(state.rows.length, 1);
  assert.equal(post(payload).ok, true);
  assert.equal(state.rows.length, 2);
  assert.equal(state.files.length, 3);
  assert.match(String(state.rows[1][22]), /drive.google.com\/file\/d\/private-cv-1\/view/);
  assert.match(String(state.rows[1][26]), /drive.google.com\/file\/d\/private-cv-2\/view/);
  assert.equal(post(payload).duplicate, true);
  assert.equal(state.files.length, 3);
  assert.equal(state.rows.length, 2);
  const invalid = { ...payload, documents: [payload.documents[0], { ...payload.documents[1], category: "diploma" }] };
  assert.equal(post(invalid).code, "INVALID_DOCUMENT");
});

test("receiver migration removes only retired status columns and preserves existing applicant details and document links", () => {
  const { state, context } = fixture();
  const currentHeaders = state.rows[0].slice(0, 27);
  state.rows[0] = [...currentHeaders];
  state.rows[0].splice(17, 0, "NC2 status", "Diploma status", "NBI/apostille status", "Form 18a status");
  const originalRow = currentHeaders.map((_, index) => "existing-cell-" + index);
  state.rows.push([...originalRow]);
  state.rows[1].splice(17, 0, "Ready", "Ready", "In progress", "Not yet available");
  state.maxColumns = 31;
  context.migrationSheet = {
    getLastRow: () => state.rows.length, getMaxColumns: () => state.maxColumns,
    getLastColumn: () => state.rows[0].length,
    getRange: (_row: number, column: number, _count: number, columns: number) => ({ getValues: () => [state.rows[0].slice(column - 1, column - 1 + columns)] }),
    deleteColumns: (column: number, count: number) => { state.rows.forEach((row) => row.splice(column - 1, count)); state.maxColumns -= count; },
  };
  vm.runInContext("chapterRemoveLegacyStatusColumns_(migrationSheet)", context);
  assert.deepEqual(state.rows[0], currentHeaders);
  assert.deepEqual(state.rows[1], originalRow);
  assert.equal(state.maxColumns, 27);
  vm.runInContext("chapterRemoveLegacyStatusColumns_(migrationSheet)", context);
  assert.deepEqual(state.rows[1], originalRow);
  state.rows[0].splice(17, 0, "NC2 status", "Diploma status", "NBI/apostille status", "Form 18a status");
  state.rows[0][30] = "Unrelated column"; state.maxColumns = 31;
  assert.throws(() => vm.runInContext("chapterRemoveLegacyStatusColumns_(migrationSheet)", context), /HEADER_MISMATCH/);
  assert.equal(state.maxColumns, 31);
});

test("driver license details and all six optional documents align, remain private and deduplicate seven files", () => {
  const { state, post } = fixture();
  const original = application();
  const payload = { ...original, version: 2,
    application: { ...original.application, driverLicenseDetails: "Professional license, Philippines" },
    documents: ["diploma", "nc2", "nbi", "form18a", "other", "driver-license"].map((category) => ({
      ...original.resume, id: `test-${category}`, category, name: `${category}.pdf`,
    })),
  };
  assert.equal(post(payload).ok, true);
  assert.equal(state.files.length, 7);
  assert.match(String(state.rows[1][24]), /drive.google.com\/file\/d\/private-cv-3\/view/);
  assert.match(String(state.rows[1][25]), /drive.google.com\/file\/d\/private-cv-4\/view/);
  assert.equal(state.rows[1][27], payload.application.driverLicenseDetails);
  assert.match(String(state.rows[1][28]), /drive.google.com\/file\/d\/private-cv-6\/view/);
  assert.equal(post(payload).duplicate, true);
  assert.equal(state.files.length, 7);
  assert.equal(state.rows.length, 2);
  assert.equal(post({ ...payload, application: { ...payload.application, driverLicenseDetails: "Different category" } }).code, "EXISTING_DOCUMENT_MISMATCH");
  assert.equal(post({ ...payload, application: { ...payload.application, driverLicenseDetails: "x".repeat(201) } }).code, "INVALID_APPLICATION");
});
