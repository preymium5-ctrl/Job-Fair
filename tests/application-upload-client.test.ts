import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ApplicationUploadError,
  prepareApplicationUpload,
  stageApplicationUpload,
} from "../lib/application-upload-client";

const MiB = 1024 * 1024;
const chunkBytes = 2 * MiB;
const submissionKey = "synthetic-upload-retry-key";
const payload = { jobId: "synthetic-job", fullName: "Test Applicant", referralSource: "Facebook" };

interface StartRequest {
  action: "start";
  payload: typeof payload;
  submissionKey: string;
  upload: { sha256: string; totalBytes: number; chunkCount: number; contentType: string };
  files: { field: string; name: string; size: number; type: string }[];
}
interface ChunkRequest {
  action: "chunk";
  ticket: string;
  index: number;
  base64: string;
}
type UploadRequest = StartRequest | ChunkRequest;

function formWithFile(size: number) {
  const contents = new Uint8Array(size);
  for (let index = 0; index < contents.length; index++) contents[index] = index % 251;
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  form.append("resume", new File([contents], "synthetic-resume.pdf", { type: "application/pdf" }));
  form.append("website", "");
  form.append("idempotencyKey", submissionKey);
  return { form, contents };
}

function readRequest(input: string | URL | Request, init?: RequestInit): UploadRequest {
  assert.equal(input, "/api/applications/uploads");
  assert.equal(init?.method, "POST");
  assert.equal(new Headers(init?.headers).get("content-type"), "application/json");
  assert.ok(init?.signal instanceof AbortSignal);
  assert.equal(typeof init?.body, "string");
  const body = init!.body as string;
  assert.ok(Buffer.byteLength(body) < 3_000_000, "Each JSON request stays below the platform request limit");
  const request = JSON.parse(body) as UploadRequest;
  assert.ok(request.action === "start" || request.action === "chunk");
  return request;
}

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Buffer.from(digest).toString("hex");
}

async function acknowledgement(request: ChunkRequest, uploadId = "synthetic-upload") {
  const bytes = Buffer.from(request.base64, "base64");
  return { uploadId, index: request.index, bytes: bytes.length, sha256: await sha256(bytes) };
}

test("small applications use the original direct FormData without staging requests", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected staging request"); });
  const { form } = formWithFile(4096);
  const upload = await prepareApplicationUpload(form, submissionKey);
  const progress: number[] = [];
  const transmission = await stageApplicationUpload(upload, (percent) => progress.push(percent));

  assert.equal(transmission.staged, false);
  assert.strictEqual(transmission.body, form);
  assert.equal(transmission.contentType, undefined);
  assert.deepEqual(progress, []);
  assert.equal(upload.sha256, "");
  assert.equal(upload.ticket, undefined);
  assert.equal(upload.uploadedChunks.size, 0);
});

test("a 5 MiB file is staged as sequential raw chunks of at most 2 MiB and reconstructs exactly", async (t) => {
  const requests: UploadRequest[] = [];
  const chunks: Buffer[] = [];
  let activeRequests = 0;
  let maximumActiveRequests = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const request = readRequest(input, init);
    requests.push(request);
    activeRequests++;
    maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
    try {
      if (request.action === "start")
        return Response.json({ ticket: "synthetic-ticket", uploadId: "synthetic-upload", chunkCount: request.upload.chunkCount });
      assert.equal(request.ticket, "synthetic-ticket");
      const chunk = Buffer.from(request.base64, "base64");
      assert.ok(chunk.length > 0 && chunk.length <= chunkBytes);
      chunks.push(chunk);
      return Response.json(await acknowledgement(request));
    } finally {
      activeRequests--;
    }
  });
  const { form, contents } = formWithFile(5 * MiB);
  const upload = await prepareApplicationUpload(form, submissionKey);
  const progress: number[] = [];
  const transmission = await stageApplicationUpload(upload, (percent) => progress.push(percent));

  assert.equal(maximumActiveRequests, 1);
  assert.deepEqual(requests.map((request) => request.action === "start" ? "start" : request.index), ["start", 0, 1, 2]);
  const start = requests[0] as StartRequest;
  assert.deepEqual(start.payload, payload);
  assert.equal(start.submissionKey, submissionKey);
  assert.deepEqual(start.files, [{ field: "resume", name: "synthetic-resume.pdf", size: 5 * MiB, type: "application/pdf" }]);
  assert.deepEqual(start.upload, { sha256: await sha256(upload.bytes), totalBytes: upload.bytes.length, chunkCount: 3, contentType: upload.contentType });
  assert.deepEqual(chunks.map((chunk) => chunk.length), [chunkBytes, chunkBytes, upload.bytes.length - 2 * chunkBytes]);
  const reconstructed = Buffer.concat(chunks);
  assert.deepEqual(reconstructed, Buffer.from(upload.bytes));
  const decodedForm = await new Response(reconstructed, { headers: { "Content-Type": upload.contentType } }).formData();
  const decodedFile = decodedForm.get("resume");
  assert.ok(decodedFile instanceof File);
  assert.equal(decodedFile.name, "synthetic-resume.pdf");
  assert.deepEqual(new Uint8Array(await decodedFile.arrayBuffer()), contents);
  assert.equal(decodedForm.get("payload"), JSON.stringify(payload));
  assert.equal(decodedForm.get("idempotencyKey"), submissionKey);
  assert.equal(transmission.staged, true);
  assert.equal(transmission.contentType, "application/json");
  assert.deepEqual(JSON.parse(transmission.body as string), { stagedUploadTicket: "synthetic-ticket" });
  assert.deepEqual(progress, [30, 60, 90]);
});

test("an unchanged retry reuses the exact cached multipart boundary, bytes, digest and acknowledged chunks", async (t) => {
  const requests: UploadRequest[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const request = readRequest(input, init);
    requests.push(request);
    return request.action === "start"
      ? Response.json({ ticket: "synthetic-ticket", uploadId: "synthetic-upload", chunkCount: request.upload.chunkCount })
      : Response.json(await acknowledgement(request));
  });
  const { form } = formWithFile(3_600_000);
  const upload = await prepareApplicationUpload(form, submissionKey);
  const cachedBytes = upload.bytes;
  const originalBytes = upload.bytes.slice();
  const originalContentType = upload.contentType;
  const originalDigest = upload.sha256;
  assert.match(originalContentType, /^multipart\/form-data; boundary=/);
  const first = await stageApplicationUpload(upload, () => {});
  const firstRequestCount = requests.length;
  const retry = await stageApplicationUpload(upload, () => {});

  assert.equal(requests.length, firstRequestCount, "A final submission retry does not resend completed chunks");
  assert.deepEqual(retry, first);
  assert.strictEqual(upload.bytes, cachedBytes);
  assert.deepEqual(upload.bytes, originalBytes);
  assert.equal(upload.contentType, originalContentType);
  assert.equal(upload.sha256, originalDigest);
  assert.equal(upload.key, submissionKey);
  assert.equal(upload.uploadedChunks.size, Math.ceil(upload.bytes.length / chunkBytes));
});

test("a partial network failure resumes after the chunks already acknowledged", async (t) => {
  const requests: UploadRequest[] = [];
  let failSecondChunk = true;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const request = readRequest(input, init);
    requests.push(request);
    if (request.action === "start")
      return Response.json({ ticket: "synthetic-ticket", uploadId: "synthetic-upload", chunkCount: request.upload.chunkCount });
    if (request.index === 1 && failSecondChunk) {
      failSecondChunk = false;
      throw new TypeError("Synthetic connection loss");
    }
    return Response.json(await acknowledgement(request));
  });
  const { form } = formWithFile(5 * MiB);
  const upload = await prepareApplicationUpload(form, submissionKey);
  const originalBytes = upload.bytes.slice();
  await assert.rejects(stageApplicationUpload(upload, () => {}), ApplicationUploadError);
  assert.deepEqual([...upload.uploadedChunks], [0]);
  assert.equal(upload.ticket, "synthetic-ticket");
  const retry = await stageApplicationUpload(upload, () => {});

  assert.equal(retry.staged, true);
  assert.deepEqual(requests.map((request) => request.action === "start" ? "start" : request.index), ["start", 0, 1, 1, 2]);
  assert.deepEqual([...upload.uploadedChunks], [0, 1, 2]);
  assert.deepEqual(upload.bytes, originalBytes);
});

test("conflicting chunk acknowledgements are rejected without caching the unconfirmed chunk", async (t) => {
  const conflicts = [
    { uploadId: "another-upload" },
    { index: 99 },
    { bytes: 1 },
    { sha256: "0".repeat(64) },
  ];
  for (const conflict of conflicts) {
    await t.test(`rejects a conflicting ${Object.keys(conflict)[0]}`, async (subtest) => {
      const requests: UploadRequest[] = [];
      subtest.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        const request = readRequest(input, init);
        requests.push(request);
        return request.action === "start"
          ? Response.json({ ticket: "synthetic-ticket", uploadId: "synthetic-upload", chunkCount: request.upload.chunkCount })
          : Response.json({ ...await acknowledgement(request), ...conflict });
      });
      const { form } = formWithFile(3_600_000);
      const upload = await prepareApplicationUpload(form, submissionKey);
      await assert.rejects(stageApplicationUpload(upload, () => {}), {
        name: "Error", message: "We couldn’t confirm one part of your upload. Select Submit to retry.",
      });
      assert.deepEqual(requests.map((request) => request.action === "start" ? "start" : request.index), ["start", 0]);
      assert.equal(upload.uploadedChunks.size, 0);
    });
  }
});

test("an expired stage clears acknowledged state and starts a new stage with the same serialized application", async (t) => {
  const requests: UploadRequest[] = [];
  let stage = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const request = readRequest(input, init);
    requests.push(request);
    if (request.action === "start") {
      stage++;
      return Response.json({ ticket: `ticket-${stage}`, uploadId: `upload-${stage}`, chunkCount: request.upload.chunkCount });
    }
    assert.equal(request.ticket, `ticket-${stage}`);
    if (stage === 1 && request.index === 1)
      return Response.json({ error: "This upload expired. Please retry.", code: "UPLOAD_STAGE_EXPIRED" }, { status: 410 });
    return Response.json(await acknowledgement(request, `upload-${stage}`));
  });
  const { form } = formWithFile(5 * MiB);
  const upload = await prepareApplicationUpload(form, submissionKey);
  const originalBytes = upload.bytes.slice();
  const originalContentType = upload.contentType;
  await assert.rejects(stageApplicationUpload(upload, () => {}), (error: unknown) => {
    assert.ok(error instanceof ApplicationUploadError);
    assert.equal(error.code, "UPLOAD_STAGE_EXPIRED");
    return true;
  });
  assert.equal(upload.ticket, undefined);
  assert.equal(upload.uploadId, undefined);
  assert.equal(upload.uploadedChunks.size, 0);
  const retry = await stageApplicationUpload(upload, () => {});

  assert.deepEqual(requests.map((request) => request.action === "start" ? "start" : `${request.ticket}:${request.index}`), [
    "start", "ticket-1:0", "ticket-1:1", "start", "ticket-2:0", "ticket-2:1", "ticket-2:2",
  ]);
  const starts = requests.filter((request): request is StartRequest => request.action === "start");
  assert.deepEqual(starts[0], starts[1]);
  assert.deepEqual(upload.bytes, originalBytes);
  assert.equal(upload.contentType, originalContentType);
  assert.equal(upload.key, submissionKey);
  assert.equal(upload.ticket, "ticket-2");
  assert.deepEqual(JSON.parse(retry.body as string), { stagedUploadTicket: "ticket-2" });
});
