import { createHmac } from "node:crypto";
import { buildSheetsPayload, sendApplicationToSheets, type SheetsDocument, type SheetsTransport } from "./sheets-transport";
import type { ValidatedResume, validateSupportingDocument } from "./storage";
import type { SupportingDocumentCategory } from "./document-uploads";
import type { Application, ApplicationInput, Job } from "./types";

export function usesGoogleApplicationStorage() {
  return process.env.APPLICATION_STORAGE === "google-sheets";
}

type DocumentUpload = {
  category: SupportingDocumentCategory;
  document: Awaited<ReturnType<typeof validateSupportingDocument>>;
};

/** Google Sheets and private Drive are the durable record in this explicit mode. */
export async function saveApplicationToGoogle(
  input: ApplicationInput,
  job: Job,
  submissionKey: string,
  requestHash: string,
  resume: ValidatedResume,
  uploads: DocumentUpload[],
  transport: SheetsTransport = sendApplicationToSheets,
) {
  // ID stays the same for a retry; reference binds the entire validated request.
  // The receiver rejects the same ID with a different reference before writing.
  const id = `gs-${submissionKey}`;
  const reference = `CH-${createHmac("sha256", process.env.GOOGLE_SHEETS_WEBHOOK_SECRET!)
    .update(`application-v1\0${submissionKey}\0${requestHash}`).digest("hex").slice(0, 24).toUpperCase()}`;
  const documents = uploads.map(({ category, document }) => ({
    id: `${id}-${category}`, category, name: document.name, mime: document.mime,
    key: "", size: document.bytes.length,
  }));
  const application: Application = {
    ...input, id, reference, jobTitle: job.title, status: "New", submittedAt: new Date().toISOString(),
    resumeKey: "", resumeName: resume.name, resumeMime: resume.mime,
    ...(documents.length ? { documents } : {}), isExample: job.isExample,
  };
  const exported: SheetsDocument[] = uploads.map(({ category, document }, index) => ({
    id: documents[index].id, category, name: document.name, mime: document.mime,
    base64: document.bytes.toString("base64"),
  }));
  const acknowledgement = await transport(buildSheetsPayload(application, resume.bytes, job, exported), { timeoutMs: 100_000 });
  // Never show a success/reference until the durable receiver confirms this record.
  if (acknowledgement.ok !== true || acknowledgement.applicationId !== id || acknowledgement.reference !== reference ||
      !Number.isSafeInteger(acknowledgement.row) || acknowledgement.row < 2 || typeof acknowledgement.duplicate !== "boolean")
    throw new Error("INVALID_APPLICATION_ACKNOWLEDGEMENT");
  return { reference, jobTitle: job.title, duplicate: acknowledgement.duplicate };
}
