import type { NextRequest } from "next/server";
import { failure, json, limitedJson, serverFailure } from "@/lib/api";
import { sameOrigin } from "@/lib/auth";
import { fieldErrors } from "@/lib/validation";
import { uploadedVideoSchema, videoApplicationSchema } from "@/lib/video-applications";
import { saveVideoApplicationToGoogle } from "@/lib/video-application-storage";
import { usesGoogleApplicationStorage } from "@/lib/google-application-storage";
import { sheetsConfiguration, SheetsDeliveryError } from "@/lib/sheets-transport";
import { publishedCatalogJobs } from "@/data/application-jobs";

export const runtime = "nodejs";
export const maxDuration = 90;

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

/** Step 2 of a video application: the video is already in Drive; record the answers with it. */
export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return failure("Submit your application from this website.", 403);
    if (!usesGoogleApplicationStorage() || !sheetsConfiguration().valid)
      return failure("Video applications are temporarily unavailable. Please try again later.", 503);
    const input = await limitedJson(request, 16 * 1024);
    if (!input || typeof input !== "object" || Array.isArray(input)) return failure("Use the website application form.", 400);
    const { payload, submissionKey, video, applicationCheck, ...rest } = input as Record<string, unknown>;
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
    const saved = await saveVideoApplicationToGoogle(answers.data, job, uploaded.data, key);
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
