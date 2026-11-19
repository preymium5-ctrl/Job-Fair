import type { NextRequest } from "next/server";
import { failure, json, limitedJson, serverFailure } from "@/lib/api";
import { sameOrigin } from "@/lib/auth";
import { fieldErrors } from "@/lib/validation";
import { isUploadId, videoApplicationSchema, videoFileSchema } from "@/lib/video-applications";
import { openVideoUpload } from "@/lib/video-application-storage";
import { usesGoogleApplicationStorage } from "@/lib/google-application-storage";
import { sheetsConfiguration, SheetsDeliveryError } from "@/lib/sheets-transport";
import { publishedCatalogJobs } from "@/data/application-jobs";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Step 1 of a video application: check the answers and the chosen video, then
 * open a private Google Drive upload. The browser sends the video straight to
 * that upload, so the video itself never passes through this server.
 */
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!sameOrigin(request) || !origin) return failure("Submit your application from this website.", 403);
    if (!usesGoogleApplicationStorage() || !sheetsConfiguration().valid)
      return failure("Video applications are temporarily unavailable. Please try again later.", 503);
    const input = await limitedJson(request, 16 * 1024);
    if (!input || typeof input !== "object" || Array.isArray(input)) return failure("Use the website application form.", 400);
    const { payload, uploadId, video, ...rest } = input as Record<string, unknown>;
    if (Object.keys(rest).length || !isUploadId(uploadId)) return failure("Refresh the form and try again.");
    const answers = videoApplicationSchema.safeParse(payload);
    if (!answers.success) return failure("Check the highlighted application details.", 422, { fieldErrors: fieldErrors(answers.error) });
    const job = publishedCatalogJobs.find(({ id }) => id === answers.data.jobId);
    if (!job || job.status !== "published")
      return failure("This position is no longer accepting applications.", 409, { fieldErrors: { jobId: "Choose an open position." } });
    const file = videoFileSchema.safeParse(video);
    if (!file.success) return failure(file.error.issues[0]?.message || "Choose a different video.", 422, { fieldErrors: { video: file.error.issues[0]?.message || "Choose a different video." } });
    const session = await openVideoUpload({ uploadId, name: file.data.name, size: file.data.size, phone: answers.data.phone, origin: new URL(origin).origin });
    return json({ uploadId, uploadUrl: session.uploadUrl });
  } catch (error) {
    if (error instanceof SheetsDeliveryError) {
      if (error.code === "SUBMISSION_RATE_LIMIT") return failure("Too many videos have been sent recently. Please try again in an hour.", 429);
      return failure("We couldn’t start the video upload. Please try again in a moment.", 503);
    }
    if (error instanceof SyntaxError) return failure("Use the website application form.", 400);
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") return failure("Use the website application form.", 413);
    return serverFailure(error);
  }
}
