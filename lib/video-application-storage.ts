import { createHash, createHmac } from "node:crypto";
import { videoMime, type UploadedVideo, type VideoApplication } from "./video-applications";
import {
  requestVideoUploadSession, sendVideoApplicationToSheets,
  type VideoSheetsPayload, type VideoSheetsTransport, type VideoUploadSessionTransport,
} from "./sheets-transport";
import type { Job } from "./types";

function secret() { return process.env.GOOGLE_SHEETS_WEBHOOK_SECRET!; }

/** A keyed hash of the WhatsApp digits: the receiver can count uploads per applicant without seeing the number. */
export function contactKey(phone: string) {
  return createHmac("sha256", secret()).update(`video-contact-v1\0${phone.replace(/\D/g, "")}`).digest("hex");
}

/** Opens a private Google Drive upload for one video and returns its upload URL. */
export async function openVideoUpload(
  input: { uploadId: string; name: string; size: number; phone: string; origin: string },
  transport: VideoUploadSessionTransport = requestVideoUploadSession,
) {
  const mime = videoMime(input.name);
  if (!mime) throw new Error("UNSUPPORTED_VIDEO");
  return transport({
    kind: "video-upload-session", version: 1, uploadId: input.uploadId, name: input.name, mime,
    size: input.size, origin: input.origin, contactKey: contactKey(input.phone),
  });
}

/** Google Sheets and private Drive are the durable record for video applications. */
export async function saveVideoApplicationToGoogle(
  input: VideoApplication,
  job: Pick<Job, "id" | "title">,
  video: UploadedVideo,
  /** Already checked and re-encoded as JPG on the server. */
  photo: { name: string; bytes: Buffer },
  submissionKey: string,
  transport: VideoSheetsTransport = sendVideoApplicationToSheets,
) {
  const mime = videoMime(video.name);
  if (!mime) throw new Error("UNSUPPORTED_VIDEO");
  // The ID stays the same for a retry; the reference binds the answers, the stored video and the photo.
  const id = `va-${submissionKey}`;
  const photoHash = createHash("sha256").update(photo.bytes).digest("hex");
  const requestHash = createHash("sha256").update(JSON.stringify({ input, video, photo: { name: photo.name, sha256: photoHash } })).digest("hex");
  const reference = `VA-${createHmac("sha256", secret())
    .update(`video-application-v1\0${submissionKey}\0${requestHash}`).digest("hex").slice(0, 24).toUpperCase()}`;
  const payload: VideoSheetsPayload = {
    kind: "video-application",
    version: 2,
    application: {
      id, reference, submittedAt: new Date().toISOString(), jobId: job.id, jobTitle: job.title,
      fullName: input.fullName, age: input.age, nationality: input.nationality, experienceYears: input.experienceYears,
      phone: input.phone, telegram: input.telegram, termsAccepted: true, consent: true, applicationSource: "Jobs in Croatia",
    },
    video: { uploadId: video.uploadId, fileId: video.fileId, name: video.name, mime, size: video.size,
      durationSeconds: video.durationSeconds === null ? null : Math.round(video.durationSeconds) },
    photo: { id: `${id}-photo`, name: photo.name, mime: "image/jpeg", base64: photo.bytes.toString("base64") },
  };
  const acknowledgement = await transport(payload, { timeoutMs: 60_000 });
  // Never show a success/reference until the durable receiver confirms this record.
  if (acknowledgement.ok !== true || acknowledgement.applicationId !== id || acknowledgement.reference !== reference ||
      !Number.isSafeInteger(acknowledgement.row) || acknowledgement.row < 2 || typeof acknowledgement.duplicate !== "boolean")
    throw new Error("INVALID_APPLICATION_ACKNOWLEDGEMENT");
  return { reference, jobTitle: job.title, duplicate: acknowledgement.duplicate };
}
