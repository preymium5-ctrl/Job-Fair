import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { after, before, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { POST as openUpload } from "../app/api/video-applications/upload/route";
import { POST as submitVideoApplication } from "../app/api/video-applications/route";
import { MAX_VIDEO_BYTES, uploadedVideoSchema, videoApplicationSchema, videoFileSchema, videoMime } from "../lib/video-applications";
import { saveVideoApplicationToGoogle } from "../lib/video-application-storage";
import type { VideoSheetsPayload, VideoUploadSessionPayload } from "../lib/sheets-transport";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const origin = "https://www.jobsincroatiaa.com";
const secret = "synthetic-video-secret-".repeat(3);
const sent: (VideoSheetsPayload | VideoUploadSessionPayload)[] = [];
const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=synthetic-session";
let receiverReply: (payload: VideoSheetsPayload | VideoUploadSessionPayload) => unknown;

function answers(overrides: Record<string, unknown> = {}) {
  return {
    form: "video-v1", fullName: "Juan Santos Dela Cruz", age: 34, nationality: "Filipino", jobId: "job-order-trailer-driver",
    experienceYears: 6, phone: "+63 917 123 4567", telegram: "+63 917 765 4321", termsAccepted: true, consent: true, ...overrides,
  };
}
function video(overrides: Record<string, unknown> = {}) {
  return { name: "welding.mp4", size: 40 * 1024 * 1024, durationSeconds: 75.4, ...overrides };
}
let jpeg: Buffer;
function photo(overrides: Record<string, unknown> = {}) {
  return { name: "me.jpg", base64: jpeg.toString("base64"), ...overrides };
}
function post(url: string, body: unknown) {
  return new NextRequest(`${origin}${url}`, { method: "POST", body: JSON.stringify(body), headers: { origin, "content-type": "application/json" } });
}

before(async () => {
  jpeg = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#c01020" } }).jpeg().toBuffer();
  Object.assign(process.env, {
    APPLICATION_STORAGE: "google-sheets", CHAPTER_LOCAL_MODE: "false", APP_ORIGIN: origin,
    GOOGLE_SHEETS_WEBHOOK_URL: "https://script.google.com/macros/s/test-video-receiver/exec", GOOGLE_SHEETS_WEBHOOK_SECRET: secret,
  });
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const envelope = JSON.parse(String(init.body));
    assert.equal(envelope.signature, createHmac("sha256", secret).update(`${envelope.timestamp}.${envelope.payload}`).digest("hex"));
    const payload = JSON.parse(envelope.payload);
    sent.push(payload);
    return new Response(JSON.stringify(receiverReply(payload)), { status: 200 });
  }) as typeof fetch;
});
beforeEach(() => {
  sent.length = 0;
  receiverReply = (payload) => payload.kind === "video-upload-session"
    ? { ok: true, uploadId: payload.uploadId, uploadUrl }
    : { ok: true, applicationId: payload.application.id, reference: payload.application.reference, row: 2, duplicate: false };
});
after(() => { process.env = originalEnv; globalThis.fetch = originalFetch; });

test("the video form asks for name, age, nationality, position, experience, WhatsApp and Telegram", () => {
  const issues = (overrides: Record<string, unknown>) => {
    const result = videoApplicationSchema.safeParse(answers(overrides));
    return result.success ? [] : result.error.issues.map(({ path }) => path.join("."));
  };
  assert.deepEqual(issues({}), []);
  assert.deepEqual(issues({ telegram: "" }), ["telegram"]);
  assert.deepEqual(issues({ phone: "call me" }), ["phone"]);
  assert.deepEqual(issues({ age: 17, experienceYears: -1 }), ["age", "experienceYears"]);
  assert.deepEqual(issues({ age: undefined, nationality: "", fullName: "" }), ["fullName", "age", "nationality"]);
  assert.deepEqual(issues({ unexpected: "field" }), [""]);
});

test("videos must be a supported format, at least a minute long and at most 100 MB", () => {
  assert.equal(videoMime("clip.MOV"), "video/quicktime");
  assert.equal(videoMime("clip.mkv"), undefined);
  assert.ok(videoFileSchema.safeParse(video()).success);
  assert.ok(videoFileSchema.safeParse(video({ durationSeconds: null })).success, "a length the browser cannot read is recorded as not checked");
  assert.ok(videoFileSchema.safeParse(video({ size: MAX_VIDEO_BYTES })).success);
  assert.equal(videoFileSchema.safeParse(video({ size: MAX_VIDEO_BYTES + 1 })).success, false);
  assert.equal(videoFileSchema.safeParse(video({ durationSeconds: 59 })).success, false);
  assert.equal(videoFileSchema.safeParse(video({ name: "clip.mkv" })).success, false);
  assert.equal(uploadedVideoSchema.safeParse({ ...video(), uploadId: randomUUID(), fileId: "../../etc" }).success, false);
});

test("opening a video upload validates the answers, then returns only a Google Drive upload URL", async () => {
  const uploadId = randomUUID();
  const response = await openUpload(post("/api/video-applications/upload", { payload: answers(), uploadId, video: video() }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { uploadId, uploadUrl });
  const session = sent[0] as VideoUploadSessionPayload;
  assert.equal(session.kind, "video-upload-session");
  assert.equal(session.mime, "video/mp4");
  assert.equal(session.origin, origin);
  assert.match(session.contactKey, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(session).includes("917 123"), "the WhatsApp number is never sent for rate limiting");

  sent.length = 0;
  const tooBig = await openUpload(post("/api/video-applications/upload", { payload: answers(), uploadId: randomUUID(), video: video({ size: MAX_VIDEO_BYTES + 1 }) }));
  assert.equal(tooBig.status, 422);
  const noTelegram = await openUpload(post("/api/video-applications/upload", { payload: answers({ telegram: "" }), uploadId: randomUUID(), video: video() }));
  assert.equal(noTelegram.status, 422);
  assert.equal((await noTelegram.json()).fieldErrors.telegram, "Enter your Telegram number.");
  assert.equal(sent.length, 0, "invalid requests never reach Google");

  receiverReply = (payload) => ({ ok: true, uploadId: (payload as VideoUploadSessionPayload).uploadId, uploadUrl: "https://attacker.example/upload" });
  const redirected = await openUpload(post("/api/video-applications/upload", { payload: answers(), uploadId: randomUUID(), video: video() }));
  assert.equal(redirected.status, 503, "the browser is never sent anywhere but Google Drive");
  receiverReply = () => ({ ok: false, code: "SUBMISSION_RATE_LIMIT" });
  assert.equal((await openUpload(post("/api/video-applications/upload", { payload: answers(), uploadId: randomUUID(), video: video() }))).status, 429);
});

test("submitting records the answers, photo and uploaded video and returns a stable reference", async () => {
  const submissionKey = randomUUID();
  const body = { payload: answers(), submissionKey, applicationCheck: "", photo: photo(), video: { ...video(), uploadId: randomUUID(), fileId: "drive-video-file-1" } };
  // The photo is required, and must really be a JPG or PNG image.
  const noPhoto = await submitVideoApplication(post("/api/video-applications", { ...body, photo: undefined }));
  assert.equal(noPhoto.status, 422);
  assert.ok((await noPhoto.json()).fieldErrors.photo);
  const fakePhoto = await submitVideoApplication(post("/api/video-applications", { ...body, photo: photo({ base64: Buffer.from("not an image").toString("base64") }) }));
  assert.equal(fakePhoto.status, 422);
  assert.equal((await submitVideoApplication(post("/api/video-applications", { ...body, photo: photo({ name: "me.pdf" }) }))).status, 422);
  assert.equal(sent.length, 0, "a missing or invalid photo never reaches Google");
  const response = await submitVideoApplication(post("/api/video-applications", body));
  assert.equal(response.status, 201);
  const { reference, jobTitle } = await response.json();
  assert.match(reference, /^VA-[A-F0-9]{24}$/);
  assert.ok(jobTitle);
  const delivered = sent[0] as VideoSheetsPayload;
  assert.equal(delivered.application.id, `va-${submissionKey}`);
  assert.equal(delivered.video.durationSeconds, 75);
  assert.equal(delivered.video.mime, "video/mp4");
  assert.equal(delivered.version, 2);
  assert.equal(delivered.photo.id, `va-${submissionKey}-photo`);
  assert.equal(delivered.photo.mime, "image/jpeg");
  assert.equal(delivered.photo.name, "me.jpg");
  assert.deepEqual([...Buffer.from(delivered.photo.base64, "base64").subarray(0, 3)], [255, 216, 255]);
  // A retry of the same submission gets the same reference.
  assert.equal((await (await submitVideoApplication(post("/api/video-applications", body))).json()).reference, reference);

  assert.equal((await submitVideoApplication(post("/api/video-applications", { ...body, applicationCheck: "bot" }))).status, 400);
  receiverReply = () => ({ ok: false, code: "VIDEO_UNAVAILABLE" });
  const missing = await submitVideoApplication(post("/api/video-applications", { ...body, submissionKey: randomUUID() }));
  assert.equal(missing.status, 409);
  assert.equal((await missing.json()).code, "VIDEO_UNAVAILABLE");
});

test("a mismatched receiver acknowledgement never confirms a video application", async () => {
  const input = videoApplicationSchema.parse(answers());
  const uploaded = uploadedVideoSchema.parse({ ...video(), uploadId: randomUUID(), fileId: "drive-video-file-1" });
  await assert.rejects(saveVideoApplicationToGoogle(input, { id: "job", title: "Welder" }, uploaded, { name: "me.jpg", bytes: jpeg }, randomUUID(),
    async (payload) => ({ ok: true, applicationId: payload.application.id, reference: "VA-WRONG", row: 2, duplicate: false })), /INVALID_APPLICATION_ACKNOWLEDGEMENT/);
});

test("the receiver opens a Drive upload for the site's origin, then writes the video application to its own tab", () => {
  const source = readFileSync(new URL("../integrations/google-sheets/Code.gs", import.meta.url), "utf8");
  const receiverSecret = "receiver-video-test-secret-".repeat(3);
  const folderId = "private-test-folder-id";
  const properties = new Map<string, string>([["CHAPTER_WEBHOOK_SECRET", receiverSecret], ["CHAPTER_CV_FOLDER_ID", folderId]]);
  const tabs = new Map<string, { rows: unknown[][]; maxColumns: number; frozen: number }>();
  const files = new Map<string, Record<string, unknown>>();
  const sessions: { metadata: Record<string, unknown>; headers: Record<string, string> }[] = [];
  const patches: Record<string, unknown>[] = [];
  const sheetHandle = (name: string) => {
    const tab = tabs.get(name)!;
    return {
      getLastRow: () => tab.rows.length, getLastColumn: () => Math.max(0, ...tab.rows.map((row) => row.length)),
      getMaxRows: () => 1000, getMaxColumns: () => tab.maxColumns, setFrozenRows: (count: number) => { tab.frozen = count; },
      insertColumnsAfter: (_after: number, count: number) => { tab.maxColumns += count; },
      getRange: (row: number, column: number, count = 1, columns = 1) => ({
        getValues: () => Array.from({ length: count }, (_, index) => Array.from({ length: columns }, (_, offset) => tab.rows[row - 1 + index]?.[column - 1 + offset] ?? "")),
        setValues: (values: unknown[][]) => values.forEach((cells, index) => { tab.rows[row - 1 + index] = [...cells]; }),
        setValue: (value: unknown) => { (tab.rows[row - 1] ??= [])[column - 1] = value; },
        copyFormatToRange: () => undefined,
        setFontWeight: () => undefined,
      }),
    };
  };
  const spreadsheet = {
    getSheetByName: (name: string) => tabs.has(name) ? sheetHandle(name) : null,
    insertSheet: (name: string) => { tabs.set(name, { rows: [], maxColumns: 26, frozen: 0 }); return sheetHandle(name); },
  };
  tabs.set("Applications", { rows: [["untouched"]], maxColumns: 36, frozen: 1 });
  // A Video Applications tab created before photos were added: 15 columns, no Photo column.
  const earlierHeaders = ["Application ID", "Reference", "Submitted at (UTC)", "Complete name", "Age", "Nationality", "Position applying for",
    "Years of experience (position)", "WhatsApp number", "Telegram number", "Work video", "Video length", "Video file name", "Terms accepted", "Privacy consent"];
  tabs.set("Video Applications", { rows: [[...earlierHeaders]], maxColumns: 15, frozen: 1 });
  let photoMetadata: Record<string, unknown> | undefined;
  const reply = (data: unknown, headers = {}, status = 200) => ({ getResponseCode: () => status, getContentText: () => JSON.stringify(data), getAllHeaders: () => headers });
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => properties.get(key) ?? null, setProperty: (key: string, value: string) => properties.set(key, value) }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (text: string) => ({ setMimeType: () => JSON.parse(text) }) },
    Utilities: {
      Charset: { UTF_8: "utf8" }, computeHmacSha256Signature: (value: string, key: string) => [...createHmac("sha256", key).update(value).digest()],
      base64Decode: (value: string) => [...Buffer.from(value, "base64")].map((byte) => byte > 127 ? byte - 256 : byte),
      newBlob: (bytes: number[]) => Buffer.from(bytes.map((byte) => (byte + 256) % 256)),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => undefined }) },
    SpreadsheetApp: { openById: () => spreadsheet },
    ScriptApp: { getOAuthToken: () => "token" },
    UrlFetchApp: { fetch: (url: string, options: Record<string, unknown>) => {
      if (url.includes("/permissions?")) return reply({ permissions: [{ type: "user", role: "owner" }] });
      if (url.includes(`/files/${folderId}?`)) return reply({ id: folderId, mimeType: "application/vnd.google-apps.folder", trashed: false });
      if (url.includes("/drive/v3/files?q=")) {
        const query = decodeURIComponent(url);
        if (query.includes("createdTime")) return reply({ files: [] });
        const applicationId = /key='chapterApplicationId' and value='([^']+)'/.exec(query)?.[1];
        return reply({ files: [...files.values()].filter((file) => (file.appProperties as Record<string, string>).chapterApplicationId === applicationId) });
      }
      if (url.includes("upload_id=photo")) {
        const file = { ...photoMetadata, id: "drive-photo-file-1", size: String((options.payload as Buffer).length), trashed: false };
        files.set(file.id, file);
        return reply(file);
      }
      if (url.includes("uploadType=resumable") && String(options.payload).includes('"image/jpeg"')) {
        photoMetadata = JSON.parse(String(options.payload));
        return reply({}, { Location: "https://www.googleapis.com/upload/drive/v3/files?upload_id=photo-1" });
      }
      if (url.includes("uploadType=resumable")) {
        sessions.push({ metadata: JSON.parse(String(options.payload)), headers: options.headers as Record<string, string> });
        return reply({}, { Location: `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-${sessions.length}` });
      }
      const values = /\/values\/'Video Applications'!A(\d+):P(\d+)\?valueInputOption=RAW$/.exec(decodeURIComponent(url));
      if (values) {
        const row = JSON.parse(String(options.payload)).values[0];
        tabs.get("Video Applications")!.rows[Number(values[1]) - 1] = row;
        return reply({ updatedRows: 1, updatedColumns: row.length, updatedRange: `'Video Applications'!A${values[1]}:P${values[1]}` });
      }
      const fileMatch = /\/drive\/v3\/files\/([^?/]+)\?/.exec(url);
      if (fileMatch) {
        const file = files.get(decodeURIComponent(fileMatch[1]));
        if (!file) return reply({ error: "not found" }, {}, 404);
        if (options.method === "patch") { patches.push(JSON.parse(String(options.payload))); return reply({ id: file.id }); }
        return reply(file);
      }
      throw new Error(`Unexpected Google request ${url}`);
    } },
  });
  vm.runInContext(source, context);
  const call = (body: unknown) => {
    const timestamp = Date.now();
    const serialized = JSON.stringify(body);
    context.event = { postData: { contents: JSON.stringify({ timestamp, payload: serialized, signature: createHmac("sha256", receiverSecret).update(`${timestamp}.${serialized}`).digest("hex") }) } };
    return vm.runInContext("doPost(event)", context) as Record<string, unknown>;
  };

  // 1. Open the upload link.
  const uploadId = randomUUID();
  const session = { kind: "video-upload-session", version: 1, uploadId, name: "welding.mp4", mime: "video/mp4", size: 1234567, origin, contactKey: "a".repeat(64) };
  assert.deepEqual(call(session), { ok: true, uploadId, uploadUrl: "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-1" });
  assert.equal(sessions[0].headers.Origin, origin, "Drive only accepts the browser's upload from the website");
  assert.equal(sessions[0].headers["X-Upload-Content-Length"], "1234567", "Drive refuses more bytes than declared");
  assert.deepEqual(sessions[0].metadata.parents, [folderId]);
  assert.equal(call({ ...session, mime: "video/webm" }).code, "INVALID_VIDEO");
  assert.equal(call({ ...session, size: 100 * 1024 * 1024 + 1 }).code, "INVALID_VIDEO");
  assert.equal(call({ ...session, origin: "https://evil.example/path" }).code, "INVALID_VIDEO");
  // Retrying the same upload does not count twice; five different uploads per WhatsApp number per hour.
  call(session);
  for (let index = 0; index < 4; index++) assert.equal(call({ ...session, uploadId: randomUUID() }).ok, true);
  assert.equal(call({ ...session, uploadId: randomUUID() }).code, "SUBMISSION_RATE_LIMIT");
  assert.equal(call({ ...session, uploadId: randomUUID(), contactKey: "b".repeat(64) }).ok, true);

  // 2. The browser finished the upload; Drive now holds the file.
  files.set("drive-video-file-1", { id: "drive-video-file-1", name: "Unsubmitted video application — welding.mp4", mimeType: "video/mp4", size: "1234567",
    trashed: false, parents: [folderId], appProperties: { chapterVideoUploadId: uploadId, chapterVideoPending: "1" } });

  // 3. Record the application.
  const id = `va-${randomUUID()}`;
  const payload = {
    kind: "video-application", version: 2,
    application: { id, reference: "VA-0123456789ABCDEF01234567", submittedAt: new Date().toISOString(), jobId: "job", jobTitle: "Welder",
      fullName: "=SUM(1,1) Dela Cruz", age: 34, nationality: "Filipino", experienceYears: 6, phone: "+63 917 123 4567", telegram: "+63 917 765 4321",
      termsAccepted: true, consent: true, applicationSource: "Jobs in Croatia" },
    video: { uploadId, fileId: "drive-video-file-1", name: "welding.mp4", mime: "video/mp4", size: 1234567, durationSeconds: 75 },
    photo: { id: `${id}-photo`, name: "me.jpg", mime: "image/jpeg", base64: jpeg.toString("base64") },
  };
  assert.equal(call({ ...payload, photo: undefined }).code, "INVALID_SCHEMA", "the photo is required");
  assert.equal(call({ ...payload, version: 1 }).code, "INVALID_VERSION");
  assert.equal(call({ ...payload, photo: { ...payload.photo, base64: Buffer.from("%PDF-1.4").toString("base64") } }).code, "INVALID_PHOTO");
  assert.equal(call({ ...payload, photo: { ...payload.photo, id: "other-photo" } }).code, "INVALID_PHOTO");
  assert.equal(call({ ...payload, video: { ...payload.video, uploadId: randomUUID() } }).code, "VIDEO_UNAVAILABLE", "a video from another upload is refused");
  assert.equal(call({ ...payload, video: { ...payload.video, fileId: "missing-file-id" } }).code, "VIDEO_UNAVAILABLE");
  assert.equal(call({ ...payload, video: { ...payload.video, size: 1234 } }).code, "VIDEO_UNAVAILABLE", "an incomplete upload is refused");
  assert.equal(call({ ...payload, video: { ...payload.video, durationSeconds: 30 } }).code, "INVALID_VIDEO");
  const first = call(payload);
  assert.deepEqual(first, { ok: true, applicationId: id, reference: payload.application.reference, row: 2, duplicate: false });
  const tab = tabs.get("Video Applications")!;
  // The earlier 15-column tab gained the Photo column at the end.
  assert.deepEqual(tab.rows[0], [...vm.runInContext("CHAPTER_VIDEO_HEADERS", context)]);
  assert.deepEqual(tab.rows[0], [...earlierHeaders, "Photo"]);
  assert.equal(tab.maxColumns, 16);
  assert.deepEqual(tab.rows[1], [id, payload.application.reference, payload.application.submittedAt, "=SUM(1,1) Dela Cruz", 34, "Filipino", "Welder", 6,
    "+63 917 123 4567", "+63 917 765 4321", "https://drive.google.com/file/d/drive-video-file-1/view", "1:15", "welding.mp4", "Yes", "Yes",
    "https://drive.google.com/file/d/drive-photo-file-1/view"]);
  // The photo is stored privately in the applicant folder, tied to this application.
  const storedPhoto = files.get("drive-photo-file-1")!;
  assert.deepEqual(storedPhoto.parents, [folderId]);
  assert.deepEqual(storedPhoto.appProperties, { chapterApplicationId: id, chapterReference: payload.application.reference, chapterDocumentId: `${id}-photo` });
  assert.equal(storedPhoto.size, String(jpeg.length));
  assert.deepEqual(patches.at(-1), { name: "VA-0123456789ABCDEF01234567 — =SUM(1,1) Dela Cruz — welding.mp4",
    appProperties: { chapterApplicationId: id, chapterReference: payload.application.reference, chapterVideoPending: null } });
  assert.deepEqual(call(payload), { ...first, duplicate: true });
  assert.equal(tab.rows.length, 2);
  assert.deepEqual(tabs.get("Applications")!.rows, [["untouched"]]);
});

test("the Google Form builder asks the website's questions and sends answers to its own tab", async () => {
  const { publishedCatalogJobs, additionalApplicationJobOptions } = await import("../data/application-jobs");
  const source = readFileSync(new URL("../integrations/google-sheets/Code.gs", import.meta.url), "utf8");
  const properties = new Map<string, string>([["CHAPTER_WEBHOOK_SECRET", "form-test-secret-".repeat(3)]]);
  type Item = { type: string; title: string; help?: string; required?: boolean; choices?: string[]; pattern?: string };
  const items: Item[] = [];
  const settings: Record<string, unknown> = {};
  let destination = "";
  let forms = 0;
  const builder = (item: Item) => {
    const chain: Record<string, (...args: unknown[]) => unknown> = {
      setTitle: (title) => { item.title = String(title); return chain; },
      setHelpText: (help) => { item.help = String(help); return chain; },
      setRequired: (required) => { item.required = Boolean(required); return chain; },
      setChoiceValues: (choices) => { item.choices = [...(choices as string[])]; return chain; },
      setValidation: (validation) => { item.pattern = (validation as { pattern: string }).pattern; return chain; },
    };
    items.push(item);
    return chain;
  };
  const form = {
    getId: () => "form-123", getEditUrl: () => "https://docs.google.com/forms/d/form-123/edit",
    getPublishedUrl: () => "https://docs.google.com/forms/d/e/published/viewform",
    setTitle: (value: string) => { settings.title = value; }, setDescription: (value: string) => { settings.description = value; }, setConfirmationMessage: (value: string) => { settings.confirmation = value; },
    setAllowResponseEdits: (value: boolean) => { settings.edits = value; }, setShowLinkToRespondAgain: () => undefined,
    setCollectEmail: () => undefined, setPublished: (value: boolean) => { settings.published = value; },
    setAcceptingResponses: (value: boolean) => { settings.accepting = value; },
    addTextItem: () => builder({ type: "TEXT", title: "" }), addListItem: () => builder({ type: "LIST", title: "" }),
    addSectionHeaderItem: () => builder({ type: "SECTION_HEADER", title: "" }), addCheckboxItem: () => builder({ type: "CHECKBOX", title: "" }),
    getItems: (type: string) => items.filter((item) => item.type === type).map((item) => ({
      getTitle: () => item.title, asListItem: () => ({ setChoiceValues: (choices: string[]) => { item.choices = [...choices]; } }),
    })),
    getDestinationId: () => { if (!destination) throw new Error("no destination"); return destination; },
    setDestination: (_type: string, id: string) => { destination = id; tabs.push({ name: "Form Responses 1", formUrl: "https://docs.google.com/forms/d/form-123/viewform", frozen: 0 }); },
  };
  const tabs = [{ name: "Applications", formUrl: null as string | null, frozen: 1 }, { name: "Video Applications", formUrl: null as string | null, frozen: 1 }];
  const handle = (tab: (typeof tabs)[number]) => ({ getFormUrl: () => tab.formUrl, getName: () => tab.name,
    setName: (name: string) => { tab.name = name; }, setFrozenRows: (count: number) => { tab.frozen = count; } });
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => properties.get(key) ?? null, setProperty: (key: string, value: string) => properties.set(key, value) }) },
    FormApp: {
      ItemType: { LIST: "LIST", FILE_UPLOAD: "FILE_UPLOAD" }, DestinationType: { SPREADSHEET: "SPREADSHEET" },
      create: (title: string) => { forms++; settings.title = title; return form; }, openById: (id: string) => { if (id !== "form-123") throw new Error("missing"); return form; },
      createTextValidation: () => { const validation = { pattern: "", requireTextMatchesPattern: (pattern: string) => { validation.pattern = pattern; return validation; },
        setHelpText: () => validation, build: () => validation }; return validation; },
    },
    SpreadsheetApp: { flush: () => undefined, openById: () => ({ getSheets: () => tabs.map(handle),
      getSheetByName: (name: string) => tabs.some((tab) => tab.name === name) ? {} : null }) },
    Logger: { log: () => undefined },
  });
  vm.runInContext(source, context);
  const result = vm.runInContext("setupVideoApplicationGoogleForm()", context) as Record<string, unknown>;

  assert.equal(result.created, true);
  assert.equal(result.formLink, "https://docs.google.com/forms/d/e/published/viewform");
  assert.match(String(result.nextStep), /add the photo and video upload questions/);
  assert.equal(properties.get("CHAPTER_VIDEO_FORM_ID"), "form-123");
  assert.equal(destination, vm.runInContext("CHAPTER_SHEET_ID", context), "answers go to the same spreadsheet");
  assert.deepEqual(tabs.map(({ name }) => name), ["Applications", "Video Applications", "Video Applications (Google Form)"]);
  assert.equal(tabs[2].frozen, 1);
  assert.deepEqual(items.map(({ type, title, required }) => [type, title, required ?? false]), [
    ["TEXT", "Your complete name", true], ["TEXT", "Age", true], ["TEXT", "Nationality", true], ["LIST", "Position applying for", true],
    ["TEXT", "Total years of experience in this position", true], ["TEXT", "WhatsApp number", true], ["TEXT", "Telegram number", true],
    ["SECTION_HEADER", "Your photo and work video", false], ["SECTION_HEADER", "Terms and Conditions", false],
    ["CHECKBOX", "Terms and conditions", true], ["CHECKBOX", "Privacy policy", true],
  ]);
  assert.equal(settings.published, true);
  assert.equal(settings.accepting, true);
  assert.equal(settings.edits, false);
  assert.match(String(items[7].help), /at least one minute/);

  // The answer patterns match the website's rules.
  const pattern = (title: string) => new RegExp(items.find((item) => item.title === title)!.pattern!);
  for (const age of ["18", "34", "70", " 45 "]) assert.match(age, pattern("Age"));
  for (const age of ["17", "71", "3.5", "thirty", ""]) assert.doesNotMatch(age, pattern("Age"));
  for (const years of ["0", "6", "50"]) assert.match(years, pattern("Total years of experience in this position"));
  for (const years of ["51", "-1", "2.5"]) assert.doesNotMatch(years, pattern("Total years of experience in this position"));
  for (const phone of ["+63 917 123 4567", "09171234567", "+385 (91) 123-4567"]) assert.match(phone, pattern("WhatsApp number"));
  for (const phone of ["", "12345", "call me", "+63 917 abc 4567"]) assert.doesNotMatch(phone, pattern("Telegram number"));
  assert.doesNotMatch("Jo", pattern("Your complete name"));
  assert.match("Juan Santos Dela Cruz", pattern("Your complete name"));

  // Same positions as the website's video form, in the same order.
  const open = publishedCatalogJobs.filter((job) => job.status === "published" && !job.isExample && !job.applicationOnly).map(({ title }) => title);
  const official = new Set(open.map((title) => title.toLowerCase()));
  const expected = [...open, ...additionalApplicationJobOptions.filter(({ title }) => !official.has(title.toLowerCase())).map(({ title }) => title)];
  assert.deepEqual(items[3].choices, expected, "update CHAPTER_VIDEO_FORM_POSITIONS in Code.gs when the job list changes");

  // Running it again keeps the same form and only refreshes the positions.
  assert.equal(settings.title, "Application for Job in Europe");
  items[3].choices = ["Old position"];
  settings.title = "Video Application — Jobs in Croatia";
  const again = vm.runInContext("setupVideoApplicationGoogleForm()", context) as Record<string, unknown>;
  assert.equal(again.created, false);
  assert.equal(settings.title, "Application for Job in Europe", "rerunning renames an older form");
  assert.equal(forms, 1);
  assert.equal(items.length, 11);
  assert.deepEqual(items[3].choices, expected);
  assert.equal(tabs.length, 3);
  assert.equal(again.responsesTab, "Video Applications (Google Form)");
});
