import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { failure, json, limitedFormData, limitedJson, serverFailure } from "@/lib/api";
import { sameOrigin } from "@/lib/auth";
import { fieldErrors } from "@/lib/validation";
import { UploadError, validateResume, validateSupportingDocument } from "@/lib/storage";
import { MAX_PROFILE_RESUME_BYTES } from "@/lib/document-uploads";
import { DRIVER_FILE_LIMITS, DRIVER_MAX_ENVELOPE_BYTES, DRIVER_MAX_FILE_BYTES, DRIVER_MAX_TOTAL_BYTES, driverApplicationSchema, driverUploadFields, isDriverPosition, requiredDriverDocumentFields } from "@/lib/driver-applications";
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
    } else form = await limitedFormData(request, DRIVER_MAX_ENVELOPE_BYTES);
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

    for (const [field, item] of form.entries())
      if (item instanceof File && !Object.hasOwn(DRIVER_FILE_LIMITS, field))
        return failure("Choose a supported document.", 422, { fieldErrors: { documents: "Choose a supported document." } });
    const missing = Object.fromEntries(requiredDriverDocumentFields(result.data)
      .filter((field) => !(form.get(field) instanceof File))
      .map((field) => [field, "Attach this document."]));
    if (Object.keys(missing).length) return failure("Attach the required documents.", 422, { fieldErrors: missing });

    const uploads: DriverUpload[] = [];
    const totalMessage = `Keep all files together within ${DRIVER_MAX_TOTAL_BYTES / 1024 / 1024} MB.`;
    let total = 0;
    for (const { field, maxFiles } of driverUploadFields) {
      const files = form.getAll(field);
      if (files.some((item) => !(item instanceof File)))
        return failure("Attach your documents again.", 422, { fieldErrors: { [field]: "Attach your documents again." } });
      if (files.length > maxFiles)
        return failure(`Attach up to ${maxFiles} files here.`, 422, { fieldErrors: { [field]: `Attach up to ${maxFiles} files here.` } });
      // Files keep the order the applicant added them, so IDP pages stay in page order.
      for (const file of files as File[]) {
        total += file.size;
        if (total > DRIVER_MAX_TOTAL_BYTES) return failure(totalMessage, 422, { fieldErrors: { documents: totalMessage } });
        try {
          if (field === "resume") {
            if (file.size > MAX_PROFILE_RESUME_BYTES) throw new UploadError("Your CV must be 5 MB or smaller.");
            const resume = await validateResume(file);
            uploads.push({ field, name: resume.name, mime: resume.mime, bytes: resume.bytes });
          } else {
            const document = await validateSupportingDocument(file, DRIVER_MAX_FILE_BYTES);
            uploads.push({ field, name: document.name, mime: document.mime, bytes: document.bytes });
          }
        } catch (error) {
          if (error instanceof UploadError) return failure(`${file.name}: ${error.message}`, 422, { fieldErrors: { [field]: `${file.name}: ${error.message}` } });
          throw error;
        }
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
      return failure("The upload is too large. Keep all files together within 30 MB.", 413);
    if (error instanceof Error && error.message === "INVALID_MULTIPART") return failure("Use the website application form.", 400);
    return serverFailure(error);
  }
}
