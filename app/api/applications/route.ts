import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { failure, json, limitedFormData, limitedJson, serverFailure } from "@/lib/api";
import {
  rateLimit,
  requireApplicationConfiguration,
  sameOrigin,
} from "@/lib/auth";
import {
  createApplication,
  findApplicationByKey,
  getJobById,
} from "@/lib/repository";
import { applicationSchema, fieldErrors } from "@/lib/validation";
import {
  deleteObject,
  requireStorageConfiguration,
  storeResume,
  UploadError,
  validateResume,
  validateSupportingDocument,
  storeSupportingDocument,
} from "@/lib/storage";
import type { Application } from "@/lib/types";
import { getJobFairRole } from "@/data/job-fair";
import { drainSheetsQueue } from "@/lib/sheets-queue";
import { documentLabel, getRequiredProfileDocumentCategories, isDriverPosition, MAX_APPLICATION_UPLOAD_BYTES, MAX_PROFILE_RESUME_BYTES, MAX_PROFILE_UPLOAD_BYTES, supportingDocumentTypes } from "@/lib/document-uploads";
import { saveApplicationToGoogle, usesGoogleApplicationStorage } from "@/lib/google-application-storage";
import { sheetsConfiguration, SheetsDeliveryError } from "@/lib/sheets-transport";
import { proposedJobs } from "@/data/jobs";
import { additionalApplicationJobs } from "@/data/application-jobs";
import { restoreStagedFormData, StagedUploadError } from "@/lib/staged-uploads";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  const stagedKeys: string[] = [];
  try {
    if (!sameOrigin(request))
      return failure("Submit your application from this website.", 403);
    const googleStorage = usesGoogleApplicationStorage();
    if (googleStorage) {
      if (!sheetsConfiguration().valid) throw new Error("Google application storage is not configured.");
    } else {
      if (!(await rateLimit(request, "application", 20, 3600)))
        return failure("Too many attempts. Please try again in an hour.", 429);
      requireStorageConfiguration();
      await requireApplicationConfiguration();
    }
    let form: FormData;
    if ((request.headers.get("content-type") || "").startsWith("application/json")) {
      if (!googleStorage) return failure("Use the website application form.", 400);
      const staged = await limitedJson(request, 32 * 1024);
      if (!staged || typeof staged !== "object" || Object.keys(staged).length !== 1 ||
          !("stagedUploadTicket" in staged) || typeof staged.stagedUploadTicket !== "string")
        return failure("Use the website application form.", 400);
      form = await restoreStagedFormData(staged.stagedUploadTicket);
    } else form = await limitedFormData(request, MAX_APPLICATION_UPLOAD_BYTES + 1024 * 1024);
    // Older open forms may have their hidden "website" field filled by browser
    // autofill. Ignore that retired field, including in cached staged uploads.
    if (form.getAll("applicationCheck").some((value) => typeof value !== "string" || value.trim()))
      return failure("The application could not be accepted.", 400);
    const key = String(form.get("idempotencyKey") || "").toLowerCase();
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
        key,
      )
    )
      return failure("Refresh the form and try again.");
    const payload = form.get("payload");
    if (typeof payload !== "string" || payload.length > 30000)
      return failure("The application details are invalid.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return failure("The application details are invalid.");
    }
    const result = applicationSchema.safeParse(parsed);
    if (!result.success)
      return failure("Check the highlighted application details.", 422, {
        fieldErrors: fieldErrors(result.error),
      });
    if (googleStorage && !result.data.profile)
      return failure("Complete the current website application form.", 422);
    const file = form.get("resume");
    if (!(file instanceof File))
      return failure("Attach your resume.", 422, {
        fieldErrors: { resume: "Attach a PDF, DOC, or DOCX resume." },
      });
    if (result.data.profile && file.size > MAX_PROFILE_RESUME_BYTES)
      return failure("Your CV must be 5 MB or smaller.", 422, { fieldErrors: { resume: "Your CV must be 5 MB or smaller." } });
    const resume = await validateResume(file);
    const job = googleStorage
      ? [...proposedJobs, ...additionalApplicationJobs].find(({ id }) => id === result.data.jobId)
      : await getJobById(result.data.jobId);
    const requiredDocuments = result.data.profile
      ? getRequiredProfileDocumentCategories(job?.title || "")
      : isDriverPosition(job?.title || "") ? ["driver-license"] : [];
    if (requiredDocuments.length) {
      const missingDocuments = Object.fromEntries(requiredDocuments
        .filter((category) => !(form.get(`document:${category}`) instanceof File))
        .map((category) => [`document:${category}`, `Attach your ${documentLabel(category).toLowerCase()}.`]));
      if (Object.keys(missingDocuments).length)
        return failure("Attach the required application documents.", 422, { fieldErrors: missingDocuments });
    }
    const documents: { category: (typeof supportingDocumentTypes)[number]["id"]; document: Awaited<ReturnType<typeof validateSupportingDocument>> }[] = [];
    let uploadBytes = file.size;
    const uploadLimit = result.data.profile ? MAX_PROFILE_UPLOAD_BYTES : MAX_APPLICATION_UPLOAD_BYTES;
    const uploadLimitError = "Keep all uploads together within 15 MB.";
    const allowedFileFields = new Set(["resume", ...supportingDocumentTypes.map(({ id }) => `document:${id}`)]);
    for (const [field, item] of form.entries()) {
      if (item instanceof File && !allowedFileFields.has(field))
        return failure("Choose a supported document category.", 422, { fieldErrors: { documents: "Choose a supported document category." } });
    }
    if (form.getAll("resume").length !== 1) return failure("Attach one CV only.", 422);
    for (const { id } of supportingDocumentTypes) {
      const files = form.getAll(`document:${id}`);
      if (files.length > 1 || files.some((item) => !(item instanceof File)))
        return failure("Attach one file per document category.", 422, { fieldErrors: { [`document:${id}`]: "Attach one file per document category." } });
      const attachment = files[0];
      if (attachment instanceof File) {
        uploadBytes += attachment.size;
        if (uploadBytes > uploadLimit) return failure(uploadLimitError, 422, { fieldErrors: { documents: uploadLimitError } });
        try { documents.push({ category: id, document: await validateSupportingDocument(attachment) }); }
        catch (error) {
          if (error instanceof UploadError) return failure(error.message, 422, { fieldErrors: { [`document:${id}`]: error.message } });
          throw error;
        }
      }
    }
    if (resume.bytes.length + documents.reduce((sum, item) => sum + item.document.bytes.length, 0) > uploadLimit)
      return failure(uploadLimitError, 422, { fieldErrors: { documents: uploadLimitError } });
    const requestDigest = createHash("sha256")
      .update(JSON.stringify(result.data))
      .update(resume.bytes);
    if (googleStorage) requestDigest.update(JSON.stringify({ name: resume.name, mime: resume.mime }));
    for (const { category, document } of documents) requestDigest.update(JSON.stringify({ category, name: document.name, mime: document.mime, size: document.bytes.length })).update(document.bytes);
    const requestHash = requestDigest.digest("hex");
    const existing = googleStorage ? undefined : await findApplicationByKey(key);
    if (existing) {
      if (existing.requestHash !== requestHash)
        return failure(
          "This submission ID was already used. Refresh the form before sending a different application.",
          409,
        );
      return json({
        reference: existing.data.reference,
        jobTitle: existing.data.jobTitle,
      });
    }
    if (
      !googleStorage && !(await rateLimit(
        request,
        "application-email",
        3,
        3600,
        result.data.email,
      ))
    )
      return failure(
        "You have submitted several applications recently. Please try again in an hour.",
        429,
      );
    if (!job || job.status !== "published")
      return failure("This position is no longer accepting applications.", 409);
    const fairRole = getJobFairRole(job);
    if (!result.data.profile && (result.data.driverLicenseDetails || documents.some(({ category }) => category === "driver-license")) && !fairRole?.drivingLicenseIsPlus && !isDriverPosition(job.title))
      return failure("Driver’s license details are not collected for this position.", 422, {
        fieldErrors: { driverLicenseDetails: "Remove the license details and attachment for this position." },
      });
    if (result.data.preferredEmployer && !fairRole?.employers.some((employer) => employer.name === result.data.preferredEmployer))
      return failure("Choose an employer listed for this position.", 422, {
        fieldErrors: { preferredEmployer: "Choose an employer listed for this position, or no preference." },
      });
    if (googleStorage) {
      const saved = await saveApplicationToGoogle(result.data, job, key, requestHash, resume, documents);
      return json({ reference: saved.reference, jobTitle: saved.jobTitle }, saved.duplicate ? 200 : 201);
    }
    const resumeKey = await storeResume(resume);
    stagedKeys.push(resumeKey);
    const storedDocuments: NonNullable<Application["documents"]> = [];
    for (const { category, document } of documents) {
      const key = await storeSupportingDocument(document);
      stagedKeys.push(key);
      storedDocuments.push({ id: randomUUID(), category, key, name: document.name, mime: document.mime, size: document.bytes.length });
    }
    const date = new Date();
    const reference = `CH-${date.toISOString().slice(2, 7).replace("-", "")}-${randomBytes(8).toString("hex").toUpperCase()}`;
    const application: Application = {
      ...result.data,
      id: randomUUID(),
      reference,
      jobTitle: job.title,
      status: "New",
      submittedAt: date.toISOString(),
      resumeName: resume.name,
      resumeKey,
      resumeMime: resume.mime,
      ...(storedDocuments.length ? { documents: storedDocuments } : {}),
      isExample: job.isExample,
    };
    const persisted = await createApplication(application, key, requestHash);
    if (!persisted.created) {
      await Promise.all(stagedKeys.map(deleteObject));
      stagedKeys.length = 0;
      if (persisted.requestHash !== requestHash)
        return failure(
          "This submission ID was already used. Refresh the form.",
          409,
        );
    } else stagedKeys.length = 0; // The persisted application owns these objects now.
    // Google downtime must not turn an already committed application into a failed submission.
    // The outbox owns retries even if this request or this Node process ends unexpectedly.
    await drainSheetsQueue({ applicationId: persisted.application.id, limit: 1, timeoutMs: 20_000 }).catch(() => {
      console.error("Chapter Google Sheets delivery remains queued.");
    });
    return json(
      {
        reference: persisted.application.reference,
        jobTitle: persisted.application.jobTitle,
      },
      persisted.created ? 201 : 200,
    );
  } catch (error) {
    await Promise.all(stagedKeys.map((key) => deleteObject(key).catch(() => console.error("Orphan application upload cleanup failed."))));
    if (error instanceof StagedUploadError)
      return failure(error.message, error.status, { code: error.code });
    if (error instanceof UploadError)
      return failure(error.message, 422, {
        fieldErrors: { resume: error.message },
      });
    if (error instanceof SheetsDeliveryError) {
      if (error.code === "SUBMISSION_RATE_LIMIT") return failure("Too many applications have been submitted recently. Please try again in an hour.", 429);
      if (error.code === "DUPLICATE_CONFLICT") return failure("This submission ID was already used. Refresh the form before sending a different application.", 409);
      return failure("We couldn’t confirm your application with Google Sheets. Please try again; your reference will be recovered if it was received.", 503);
    }
    if (error instanceof Error && error.message === "BODY_TOO_LARGE")
      return failure(
        "The upload is too large. Keep all files together within 15 MB.",
        413,
      );
    if (error instanceof Error && error.message === "INVALID_MULTIPART")
      return failure("Use the website application form.", 400);
    if (error instanceof Error && error.message === "JOB_NOT_OPEN")
      return failure("This position is no longer accepting applications.", 409);
    if (error instanceof Error && error.message === "MISSING_DRIVER_LICENSE")
      return failure("Attach the required driver's license for this position.", 422, {
        fieldErrors: { "document:driver-license": "Attach your driver’s license copy." },
      });
    if (error instanceof Error && error.message === "INVALID_EMPLOYER")
      return failure("Choose an employer listed for this position.", 422, {
        fieldErrors: { preferredEmployer: "Choose an employer listed for this position, or no preference." },
      });
    return serverFailure(error);
  }
}
