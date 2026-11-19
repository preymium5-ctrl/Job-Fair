import type { NextRequest } from "next/server";
import { failure, json, limitedJson, serverFailure } from "@/lib/api";
import { sameOrigin } from "@/lib/auth";
import { fieldErrors } from "@/lib/validation";
import { MAX_PHOTO_BYTES, photoSchema, uploadedVideoSchema, videoApplicationSchema } from "@/lib/video-applications";
import { UploadError, validateSupportingDocument } from "@/lib/storage";
import { saveVideoApplicationToGoogle } from "@/lib/video-application-storage";
import { usesGoogleApplicationStorage } from "@/lib/google-application-storage";
import { sheetsConfiguration, SheetsDeliveryError } from "@/lib/sheets-transport";
import { publishedCatalogJobs } from "@/data/application-jobs";

export const runtime = "nodejs";
export const maxDuration = 90;

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const MAX_REQUEST_BYTES = 4_400_000;

/** Step 2 of a video application: the video is already in Drive; record the answers and photo with it. */
export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return failure("Submit your application from this website.", 403);
    if (!usesGoogleApplicationStorage() || !sheetsConfiguration().valid)
      return failure("Video applications are temporarily unavailable. Please try again later.", 503);
    // The base64 photo (at most 3 MB) plus the answers stays within Vercel's 4.5 MB request limit.
    const input = await limitedJson(request, MAX_REQUEST_BYTES);
    if (!input || typeof input !== "object" || Array.isArray(input)) return failure("Use the website application form.", 400);
    const { payload, submissionKey, video, photo, applicationCheck, ...rest } = input as Record<string, unknown>;
    if (Object.keys(rest).length) return failure("Use the website application form.", 400);
    if (typeof applicationCheck !== "string" || applicationCheck.trim()) return failure("The application could not be accepted.", 400);
    const key = typeof submissionKey === "string" ? submissionKey.toLowerCase() : "";
    if (!UUID.test(key)) return failure("Refresh the form and try again.");
    const answers = videoApplicationSchema.safeParse(payload);
    if (!answers.success) return failure("Check the highlighted application details.", 422, { fieldErrors: fieldErrors(answers.error) });
    const uploaded = uploadedVideoSchema.safeParse(video);
    if (!uploaded.success) return failure("Upload your video again.", 422, { fieldErrors: { video: "Upload your video again." } });
    const job = publishedCatalogJobs.find(({ id }) => id === answers.data.jobId);
    if (!job || job.status !== "published")
      return failure("This position is no longer accepting applications.", 409, { fieldErrors: { jobId: "Choose an open position." } });
    const picture = photoSchema.safeParse(photo);
    if (!picture.success) return failure("Add a photo of yourself.", 422, { fieldErrors: { photo: picture.error.issues[0]?.message || "Add a JPG or PNG photo of yourself." } });
    let checkedPhoto: Awaited<ReturnType<typeof validateSupportingDocument>>;
    try {
      const bytes = Buffer.from(picture.data.base64, "base64");
      // Decodes the image and re-encodes it as a clean JPG, dropping anything hidden in the file.
      checkedPhoto = await validateSupportingDocument(new File([bytes], picture.data.name), MAX_PHOTO_BYTES);
    } catch (error) {
      if (error instanceof UploadError) return failure("Choose a different photo.", 422, { fieldErrors: { photo: "Choose a clear JPG or PNG photo, 3 MB or smaller." } });
      throw error;
    }
    const saved = await saveVideoApplicationToGoogle(answers.data, job, uploaded.data, { name: checkedPhoto.name, bytes: checkedPhoto.bytes }, key);
    return json({ reference: saved.reference, jobTitle: saved.jobTitle }, saved.duplicate ? 200 : 201);
  } catch (error) {
    if (error instanceof SheetsDeliveryError) {
      if (error.code === "SUBMISSION_RATE_LIMIT") return failure("Too many applications have been submitted recently. Please try again in an hour.", 429);
      if (error.code === "VIDEO_UNAVAILABLE")
        return failure("We couldn’t find your uploaded video. Select Submit to upload it again.", 409, { code: "VIDEO_UNAVAILABLE", fieldErrors: { video: "Upload your video again." } });
      if (error.code === "DUPLICATE_CONFLICT") return failure("This submission ID was already used. Refresh the form before sending a different application.", 409);
      return failure("We couldn’t confirm your application with Google Sheets. Please try again; your video is already saved.", 503);
    }
    if (error instanceof SyntaxError) return failure("Use the website application form.", 400);
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") return failure("Use the website application form.", 413);
    return serverFailure(error);
  }
}
