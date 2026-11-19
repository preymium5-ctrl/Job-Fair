import { createHmac } from "node:crypto";
import type { Application, ApplicationProfile } from "./types";
import type { SupportingDocumentCategory } from "./document-uploads";
import { documentLabel, privateProfileDocumentCategories } from "./document-uploads";
import { getJobFairRole } from "../data/job-fair";
import type { Job } from "./types";
import { getRetiredEmployerContext } from "./catalog-history";

export const TARGET_SPREADSHEET_ID = "1v9-lAvpJPUCxCqr03EkVwKKAfedEDtckHir4ro6cyeU";
export type SheetsErrorCode = "NOT_CONFIGURED" | "CONFIGURATION_INVALID" | "WEBHOOK_UNAVAILABLE" | "WEBHOOK_REJECTED" | "INVALID_ACKNOWLEDGEMENT" | "RESUME_UNAVAILABLE" | "SUBMISSION_RATE_LIMIT" | "DUPLICATE_CONFLICT" | "VIDEO_UNAVAILABLE";
export class SheetsDeliveryError extends Error {
  constructor(public readonly code: SheetsErrorCode) { super(code); }
}
export interface SheetsDocument { id: string; category: SupportingDocumentCategory; name: string; mime: string; base64: string; }
export interface SheetsPayload {
  version: 1 | 2 | 3;
  application: Omit<Application, "resumeKey" | "resumeName" | "resumeMime" | "isExample" | "documents" | "profile"> & {
    expectedNc2: string;
    employers: { name: string; workers: number }[];
    profile?: ApplicationProfile;
    applicationSource?: string;
    applicationFormVersion?: string;
  };
  resume: { name: string; mime: string; base64: string };
  documents?: SheetsDocument[];
}
/** Driver-only submissions go to the receiver's separate "Driver Applications" tab. */
export interface DriverSheetsPayload {
  kind: "driver-application";
  version: 1;
  application: {
    id: string; reference: string; submittedAt: string; form: string; jobId: string; jobTitle: string;
    firstName: string; lastName: string; fullName: string; email: string; phone: string; telegram: string;
    dateOfBirth: string; currentCountry: string; currentLocation: string; destinationCountry: string;
    licenseCategories: string; licenseExpiry: string; drivingExperienceYears: number; hasIdp: "Yes" | "No"; idpExpiry: string;
    meetsCzechRequirement: "Yes" | "No"; shareWithTendaDom: "Yes" | "No"; englishProficiency: "Yes" | "No";
    referralSource: string; termsAccepted: true; consent: true; applicationSource: "Jobs in Croatia";
  };
  documents: { id: string; category: string; name: string; mime: string; base64: string }[];
}
/** Quick video application: answers plus the Drive ID of a video the browser already uploaded. */
export interface VideoSheetsPayload {
  kind: "video-application";
  /** Version 2 adds the applicant's photo. */
  version: 2;
  application: {
    id: string; reference: string; submittedAt: string; jobId: string; jobTitle: string;
    fullName: string; age: number; nationality: string; experienceYears: number;
    phone: string; telegram: string; termsAccepted: true; consent: true; applicationSource: "Jobs in Croatia";
  };
  video: { uploadId: string; fileId: string; name: string; mime: string; size: number; durationSeconds: number | null };
  /** A checked, re-encoded JPG of the applicant. */
  photo: { id: string; name: string; mime: "image/jpeg"; base64: string };
}
/** Asks the receiver to open a private Drive upload that the applicant's browser fills directly. */
export interface VideoUploadSessionPayload {
  kind: "video-upload-session";
  version: 1;
  uploadId: string;
  name: string;
  mime: string;
  size: number;
  /** The website origin; Drive allows browser uploads to the session only from it. */
  origin: string;
  /** Keyed hash of the WhatsApp number, used only for rate limits. */
  contactKey: string;
}
type ReceiverPayload = SheetsPayload | DriverSheetsPayload | VideoSheetsPayload | VideoUploadSessionPayload;
export interface SheetsAcknowledgement {
  ok: true;
  applicationId: string;
  reference: string;
  row: number;
  duplicate: boolean;
}
export type SheetsTransport = (payload: SheetsPayload, options?: { timeoutMs?: number }) => Promise<SheetsAcknowledgement>;

export function sheetsConfiguration(env: Record<string, string | undefined> = process.env): {
  configured: boolean;
  valid: boolean;
  code?: SheetsErrorCode;
} {
  const url = env.GOOGLE_SHEETS_WEBHOOK_URL;
  const secret = env.GOOGLE_SHEETS_WEBHOOK_SECRET;
  if (!url && !secret) return { configured: false, valid: false, code: "NOT_CONFIGURED" };
  try {
    const parsed = new URL(url || "");
    if (parsed.protocol !== "https:" || parsed.hostname !== "script.google.com" || parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash || !/^\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(parsed.pathname) || Buffer.byteLength(secret || "") < 32)
      throw new Error("Invalid configuration");
    return { configured: true, valid: true };
  } catch {
    return { configured: true, valid: false, code: "CONFIGURATION_INVALID" };
  }
}

export function buildSheetsPayload(application: Application, resume: Buffer, job?: Job, documents: SheetsDocument[] = []): SheetsPayload {
  const { resumeKey: _key, resumeName, resumeMime, isExample: _example, documents: _documents, profile, ...details } = application;
  void _documents;
  void _key;
  void _example;
  const privateDocuments = (_documents || []).filter(({ category }) => privateProfileDocumentCategories.some((item) => item === category));
  const exportedDocuments = documents;
  const expandedPayload = Boolean(profile || exportedDocuments.some(({ category }) => privateProfileDocumentCategories.some((item) => item === category)));
  const profileSummary = profile ? [
    "Application profile",
    ...(!details.recentJobTitle && details.experienceYears == null && !details.skills
      ? ["The reference form does not collect most recent role, years of experience or a separate skills statement."] : []),
    `First name: ${profile.firstName}`,
    `Last name: ${profile.lastName}`,
    `Gender: ${profile.gender}`,
    ...(profile.nationality ? [`Nationality: ${profile.nationality}`] : []),
    ...(profile.street !== undefined
      ? [`Street: ${profile.street}`, `City: ${profile.city}`, `Province: ${profile.province}`, `Postal code: ${profile.postalCode}`]
      : [`Address: ${profile.address}`]),
    `Date of birth: ${profile.dateOfBirth}`,
    `Place of birth: ${profile.placeOfBirth}`,
    `Destination country: ${profile.destinationCountry}`,
    `Current work country: ${profile.currentWorkCountry}`,
    `Additional role with experience: ${profile.secondaryJobTitle}`,
    `Other job choice: ${profile.otherJobTitle || "Not provided"}`,
    `Speaks and understands English: ${profile.englishProficiency}`,
    `Telegram: ${profile.telegram || "Not provided"}`,
    `Father's name: ${profile.fatherName || "Not provided"}`,
    `Mother's name: ${profile.motherName || "Not provided"}`,
    `Terms accepted: ${profile.termsAccepted ? "Yes" : "No"}`,
  ].join("\n") : "";
  const documentsSummary = privateDocuments.length ? [
    "Documents available through the authorized recruitment workspace:",
    ...privateDocuments.map(({ category, name }) => `${documentLabel(category)}: ${name}`),
  ].join("\n") : "";
  const supplementalSummary = [profileSummary, documentsSummary].filter(Boolean).join("\n\n");
  // Retain the readable summary for earlier records and recruiter searches.
  // Version 3 also sends each profile answer separately, without summary truncation.
  let summary = details.summary;
  if (supplementalSummary) {
    const remaining = Math.max(0, 4000 - supplementalSummary.length - 2);
    const truncationNote = "\n[Full professional summary available in recruitment workspace.]";
    const originalSummary = summary.length <= remaining ? summary : `${summary.slice(0, Math.max(0, remaining - truncationNote.length))}${truncationNote}`;
    summary = [supplementalSummary, originalSummary].filter(Boolean).join("\n\n");
  }
  const fair = job ? getJobFairRole(job) ?? getRetiredEmployerContext(job) : undefined;
  return {
    version: expandedPayload ? 3 : exportedDocuments.length ? 2 : 1,
    ...(expandedPayload || exportedDocuments.length ? { documents: exportedDocuments } : {}),
    application: {
      ...details,
      ...(profile ? { profile, applicationSource: "Jobs in Croatia", applicationFormVersion: "profile-v1" } : {}),
      summary,
      referralSource: details.referralSource || "",
      nc2Certificate: details.nc2Certificate || "",
      preferredEmployer: details.preferredEmployer || "",
      documentReadiness: details.documentReadiness || {
        nc2: "not-yet", diploma: "not-yet", nbi: "not-yet", form18a: "not-yet",
      },
      expectedNc2: fair?.nc2 || "",
      employers: fair?.employers.map(({ name, workers }) => ({ name, workers })) || [],
    },
    resume: { name: resumeName, mime: resumeMime, base64: resume.toString("base64") },
  };
}

export function signedSheetsBody(payload: ReceiverPayload, secret: string, timestamp = Date.now()) {
  const serialized = JSON.stringify(payload);
  return JSON.stringify({
    timestamp,
    payload: serialized,
    signature: createHmac("sha256", secret).update(`${timestamp}.${serialized}`).digest("hex"),
  });
}

async function readReceiverJson(response: Response) {
  if (!response.ok) throw new SheetsDeliveryError("WEBHOOK_REJECTED");
  const reader = response.body?.getReader();
  if (!reader) throw new SheetsDeliveryError("INVALID_ACKNOWLEDGEMENT");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    length += item.value.byteLength;
    if (length > 16 * 1024) {
      await reader.cancel();
      throw new SheetsDeliveryError("INVALID_ACKNOWLEDGEMENT");
    }
    chunks.push(item.value);
  }
  let answer: unknown;
  try { answer = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new SheetsDeliveryError("INVALID_ACKNOWLEDGEMENT"); }
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) throw new SheetsDeliveryError("INVALID_ACKNOWLEDGEMENT");
  return answer as Record<string, unknown>;
}

async function readAcknowledgement(response: Response, payload: SheetsPayload | DriverSheetsPayload | VideoSheetsPayload): Promise<SheetsAcknowledgement> {
  const answer = await readReceiverJson(response);
  if (answer && answer.ok === false && (answer.code === "SUBMISSION_RATE_LIMIT" || answer.code === "DUPLICATE_CONFLICT" || answer.code === "VIDEO_UNAVAILABLE"))
    throw new SheetsDeliveryError(answer.code);
  if (!answer || answer.ok !== true || answer.applicationId !== payload.application.id || answer.reference !== payload.application.reference || typeof answer.row !== "number" || !Number.isSafeInteger(answer.row) || answer.row < 2 || typeof answer.duplicate !== "boolean")
    throw new SheetsDeliveryError("INVALID_ACKNOWLEDGEMENT");
  return { ok: true, applicationId: payload.application.id, reference: payload.application.reference,
    row: answer.row, duplicate: answer.duplicate };
}

export type DriverSheetsTransport = (payload: DriverSheetsPayload, options?: { timeoutMs?: number }) => Promise<SheetsAcknowledgement>;
export const sendDriverApplicationToSheets: DriverSheetsTransport = (payload, options) => deliver(payload, options);
export const sendApplicationToSheets: SheetsTransport = (payload, options) => deliver(payload, options);
export type VideoSheetsTransport = (payload: VideoSheetsPayload, options?: { timeoutMs?: number }) => Promise<SheetsAcknowledgement>;
export const sendVideoApplicationToSheets: VideoSheetsTransport = (payload, options) => deliver(payload, options);

export type VideoUploadSessionTransport = (payload: VideoUploadSessionPayload) => Promise<{ uploadUrl: string }>;
/** Returns the private Drive upload URL for this one video. */
export const requestVideoUploadSession: VideoUploadSessionTransport = async (payload) => {
  const answer = await callReceiver(payload, 60_000, readReceiverJson);
  if (answer.ok === false && answer.code === "SUBMISSION_RATE_LIMIT") throw new SheetsDeliveryError("SUBMISSION_RATE_LIMIT");
  const uploadUrl = answer.uploadUrl;
  if (answer.ok !== true || answer.uploadId !== payload.uploadId || typeof uploadUrl !== "string" || uploadUrl.length > 2000)
    throw new SheetsDeliveryError("INVALID_ACKNOWLEDGEMENT");
  let url: URL;
  try { url = new URL(uploadUrl); }
  catch { throw new SheetsDeliveryError("INVALID_ACKNOWLEDGEMENT"); }
  // Only ever hand the browser a Google Drive upload address.
  if (url.protocol !== "https:" || url.hostname !== "www.googleapis.com" || url.port || url.username || url.password ||
      url.pathname !== "/upload/drive/v3/files" || !url.searchParams.get("upload_id"))
    throw new SheetsDeliveryError("INVALID_ACKNOWLEDGEMENT");
  return { uploadUrl: url.toString() };
};

function deliver(payload: SheetsPayload | DriverSheetsPayload | VideoSheetsPayload, options?: { timeoutMs?: number }): Promise<SheetsAcknowledgement> {
  return callReceiver(payload, options?.timeoutMs ?? 120_000, (response) => readAcknowledgement(response, payload));
}

async function callReceiver<T>(payload: ReceiverPayload, timeoutMs: number, read: (response: Response) => Promise<T>): Promise<T> {
  const config = sheetsConfiguration();
  if (!config.valid) throw new SheetsDeliveryError(config.code!);
  const signal = AbortSignal.timeout(Math.min(280_000, Math.max(1000, timeoutMs)));
  try {
    let response = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: signedSheetsBody(payload, process.env.GOOGLE_SHEETS_WEBHOOK_SECRET!),
      signal,
      cache: "no-store",
      redirect: "manual",
    });
    // Apps Script's ContentService redirects the response to a single-use Google URL.
    // Only the signed POST goes to the configured endpoint; never forward its body elsewhere.
    if ([302, 303].includes(response.status)) {
      const location = response.headers.get("location");
      let redirect: URL;
      try { redirect = new URL(location || ""); }
      catch { throw new SheetsDeliveryError("WEBHOOK_REJECTED"); }
      if (redirect.protocol !== "https:" || redirect.hostname !== "script.googleusercontent.com" || redirect.port || redirect.username || redirect.password || redirect.pathname !== "/macros/echo")
        throw new SheetsDeliveryError("WEBHOOK_REJECTED");
      await response.body?.cancel();
      response = await fetch(redirect, { method: "GET", signal, redirect: "error", cache: "no-store" });
    }
    return await read(response);
  } catch (error) {
    if (error instanceof SheetsDeliveryError) throw error;
    throw new SheetsDeliveryError("WEBHOOK_UNAVAILABLE");
  }
}
