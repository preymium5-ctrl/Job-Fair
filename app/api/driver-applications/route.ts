import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { failure, json, limitedFormData, limitedJson, serverFailure } from "@/lib/api";
import { sameOrigin } from "@/lib/auth";
import { fieldErrors } from "@/lib/validation";
import { UploadError, validateResume, validateSupportingDocument } from "@/lib/storage";
import { MAX_APPLICATION_UPLOAD_BYTES, MAX_PROFILE_RESUME_BYTES } from "@/lib/document-uploads";
import { DRIVER_FILE_FIELDS, driverApplicationSchema, driverDocumentFields, isDriverPosition, requiredDriverDocumentFields } from "@/lib/driver-applications";
import { saveDriverApplicationToGoogle, type DriverUpload } from "@/lib/driver-application-storage";
import { usesGoogleApplicationStorage } from "@/lib/google-application-storage";
import { sheetsConfiguration, SheetsDeliveryError } from "@/lib/sheets-transport";
import { publishedCatalogJobs } from "@/data/application-jobs";
import { restoreStagedFormData, StagedUploadError } from "@/lib/staged-uploads";

export const runtime = "nodejs";
export const maxDuration = 300;

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return failure("Submit your application from this website.", 403);
    // Driver applications are recorded only in the private Google Sheet tracker.
    if (!usesGoogleApplicationStorage() || !sheetsConfiguration().valid)
      return failure("Driver applications are temporarily unavailable. Please try again later.", 503);
    let form: FormData;
    if ((request.headers.get("content-type") || "").startsWith("application/json")) {
      const staged = await limitedJson(request, 32 * 1024);
      if (!staged || typeof staged !== "object" || Object.keys(staged).length !== 1 ||
          !("stagedUploadTicket" in staged) || typeof staged.stagedUploadTicket !== "string")
        return failure("Use the website application form.", 400);
      form = await restoreStagedFormData(staged.stagedUploadTicket);
    } else form = await limitedFormData(request, MAX_APPLICATION_UPLOAD_BYTES + 1024 * 1024);
    if (form.getAll("applicationCheck").some((value) => typeof value !== "string" || value.trim()))
      return failure("The application could not be accepted.", 400);
    const key = String(form.get("idempotencyKey") || "").toLowerCase();
    if (!UUID.test(key)) return failure("Refresh the form and try again.");
    const payload = form.get("payload");
    if (typeof payload !== "string" || payload.length > 20000) return failure("The application details are invalid.");
    let parsed: unknown;
    try { parsed = JSON.parse(payload); }
    catch { return failure("The application details are invalid."); }
    const result = driverApplicationSchema.safeParse(parsed);
    if (!result.success)
      return failure("Check the highlighted application details.", 422, { fieldErrors: fieldErrors(result.error) });
    const job = publishedCatalogJobs.find(({ id }) => id === result.data.jobId);
    if (!job || job.status !== "published" || !isDriverPosition(job.title))
      return failure("This driver position is no longer accepting applications.", 409, { fieldErrors: { jobId: "Choose an open driver position." } });

    const allowed = new Set(DRIVER_FILE_FIELDS);
    for (const [field, item] of form.entries())
      if (item instanceof File && !allowed.has(field))
        return failure("Choose a supported document.", 422, { fieldErrors: { documents: "Choose a supported document." } });
    const missing = Object.fromEntries(requiredDriverDocumentFields(result.data)
      .filter((field) => !(form.get(field) instanceof File))
      .map((field) => [field, "Attach this document."]));
    if (Object.keys(missing).length) return failure("Attach the required documents.", 422, { fieldErrors: missing });
    // IDP files must be filled in order so the tracker lists every page.
    const idpFields = driverDocumentFields.filter(({ id }) => id.startsWith("idp-")).map(({ id }) => `document:${id}`);
    const lastIdp = idpFields.findLastIndex((field) => form.get(field) instanceof File);
    if (idpFields.slice(0, lastIdp + 1).some((field) => !(form.get(field) instanceof File)))
      return failure("Attach your IDP pages again.", 422, { fieldErrors: { "document:idp-1": "Attach your IDP pages again." } });

    const uploads: DriverUpload[] = [];
    let total = 0;
    for (const field of DRIVER_FILE_FIELDS) {
      const files = form.getAll(field);
      if (files.length > 1 || files.some((item) => !(item instanceof File)))
        return failure("Attach one file per document.", 422, { fieldErrors: { [field]: "Attach one file per document." } });
      const file = files[0];
      if (!(file instanceof File)) continue;
      total += file.size;
      if (total > MAX_APPLICATION_UPLOAD_BYTES)
        return failure("Keep all uploads together within 15 MB.", 422, { fieldErrors: { documents: "Keep all uploads together within 15 MB." } });
      try {
        if (field === "resume") {
          if (file.size > MAX_PROFILE_RESUME_BYTES) throw new UploadError("Your CV must be 5 MB or smaller.");
          const resume = await validateResume(file);
          uploads.push({ field, name: resume.name, mime: resume.mime, bytes: resume.bytes });
        } else {
          const document = await validateSupportingDocument(file);
          uploads.push({ field, name: document.name, mime: document.mime, bytes: document.bytes });
        }
      } catch (error) {
        if (error instanceof UploadError) return failure(error.message, 422, { fieldErrors: { [field]: error.message } });
        throw error;
      }
    }
    const digest = createHash("sha256").update(JSON.stringify(result.data));
    for (const upload of uploads) digest.update(JSON.stringify({ field: upload.field, name: upload.name, mime: upload.mime, size: upload.bytes.length })).update(upload.bytes);
    const saved = await saveDriverApplicationToGoogle(result.data, job, key, digest.digest("hex"), uploads);
    return json({ reference: saved.reference, jobTitle: saved.jobTitle }, saved.duplicate ? 200 : 201);
  } catch (error) {
    if (error instanceof StagedUploadError) return failure(error.message, error.status, { code: error.code });
    if (error instanceof SheetsDeliveryError) {
      if (error.code === "SUBMISSION_RATE_LIMIT") return failure("Too many applications have been submitted recently. Please try again in an hour.", 429);
      if (error.code === "DUPLICATE_CONFLICT") return failure("This submission ID was already used. Refresh the form before sending a different application.", 409);
      return failure("We couldn’t confirm your application with Google Sheets. Please try again; your reference will be recovered if it was received.", 503);
    }
    if (error instanceof Error && error.message === "BODY_TOO_LARGE")
      return failure("The upload is too large. Keep all files together within 15 MB.", 413);
    if (error instanceof Error && error.message === "INVALID_MULTIPART") return failure("Use the website application form.", 400);
    return serverFailure(error);
  }
}
