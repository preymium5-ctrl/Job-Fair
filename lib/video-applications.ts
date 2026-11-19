import { z } from "zod";

/**
 * Quick video application: a few answers plus one video of the applicant doing
 * the work. It is delivered to its own "Video Applications" tab.
 *
 * The video never passes through the website server (Vercel accepts only about
 * 4.5 MB per request). The receiver opens a private Google Drive upload for it,
 * the browser sends the video straight to Drive in parts, and the form answers
 * follow with the ID of the stored file.
 */
export const VIDEO_FORM_VERSION = "video-v1";
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MIN_VIDEO_SECONDS = 60;
/** Drive needs every part except the last to be a multiple of 256 KiB. */
export const VIDEO_CHUNK_BYTES = 8 * 1024 * 1024;
/**
 * The applicant's photo travels with the final submission (Vercel's 4.5 MB request
 * limit), so it is kept small: big phone photos are resized in the browser first.
 */
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const PHOTO_ACCEPT = ".jpg,.jpeg,.png";

/** File extension -> the type Drive stores the video as. */
export const videoTypes = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  "3gp": "video/3gpp",
} as const;
export type VideoMime = (typeof videoTypes)[keyof typeof videoTypes];
export const VIDEO_ACCEPT = Object.keys(videoTypes).map((extension) => `.${extension}`).join(",");

export function videoMime(name: string): VideoMime | undefined {
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() || "";
  return Object.hasOwn(videoTypes, extension) ? videoTypes[extension as keyof typeof videoTypes] : undefined;
}

const text = (maximum: number) => z.string().trim().max(maximum).regex(/^[^\x00-\x08\x0b\x0c\x0e-\x1f\x7f]*$/, "Remove unsupported control characters.");
/** One clear message per problem: empty, wrong characters, too few digits or too long. */
const contactNumber = (missing: string) => z.string().trim().superRefine((value, context) => {
  const message = !value ? missing
    : !/^[+\d\s().-]+$/.test(value) ? "Enter a valid number, using digits only."
    : value.replace(/\D/g, "").length < 7 ? "Enter at least 7 digits, including the country code."
    : value.length > 30 ? "Enter 30 characters or fewer." : "";
  if (message) context.addIssue({ code: "custom", message });
});

export const videoApplicationSchema = z.object({
  form: z.literal(VIDEO_FORM_VERSION),
  fullName: text(120).min(3, "Enter your complete name."),
  age: z.number({ error: "Enter your age." }).int("Enter your age in whole years.").min(18, "You must be at least 18 years old.").max(70, "Enter your real age."),
  nationality: text(60).min(2, "Enter your nationality."),
  jobId: z.string().trim().min(1, "Choose the position you are applying for.").max(100),
  experienceYears: z.number({ error: "Enter your years of experience." }).int("Enter whole years.").min(0, "Enter 0 or more years.").max(50, "Enter 50 years or less."),
  phone: contactNumber("Enter your WhatsApp number."),
  telegram: contactNumber("Enter your Telegram number."),
  termsAccepted: z.literal(true, { error: "Accept the terms to submit." }),
  consent: z.literal(true, { error: "Acknowledge the privacy notice to submit." }),
}).strict();
export type VideoApplication = z.output<typeof videoApplicationSchema>;

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

/** What the browser says about the chosen video, before it is uploaded. */
export const videoFileSchema = z.object({
  name: z.string().min(1).max(200).regex(/^[^\\/\x00-\x1f\x7f]+$/, "Rename the video without slashes or special characters."),
  size: z.number().int().min(1, "This video is empty. Choose it again.").max(MAX_VIDEO_BYTES, "The video must be 100 MB or smaller."),
  /** Read from the video in the browser; null when the browser cannot read this format. */
  durationSeconds: z.number().min(MIN_VIDEO_SECONDS, "The video must be at least one minute long.").max(4 * 60 * 60).nullable(),
}).strict().refine((value) => Boolean(videoMime(value.name)), { message: "Choose an MP4, MOV, M4V, WEBM or 3GP video.", path: ["name"] });

/** The video as stored in Drive, sent with the final submission. */
export const uploadedVideoSchema = z.object({
  uploadId: z.string().regex(UUID),
  fileId: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/),
  name: z.string(),
  size: z.number(),
  durationSeconds: z.number().nullable(),
}).strict().superRefine((value, context) => {
  const file = videoFileSchema.safeParse({ name: value.name, size: value.size, durationSeconds: value.durationSeconds });
  if (!file.success) for (const issue of file.error.issues) context.addIssue({ code: "custom", path: issue.path, message: issue.message });
});
export type UploadedVideo = z.output<typeof uploadedVideoSchema>;

/** The photo as sent with the final submission: a JPG or PNG, base64-encoded. */
export const photoSchema = z.object({
  name: z.string().min(1).max(200).regex(/^[^\\/\x00-\x1f\x7f]+\.(jpe?g|png)$/i, "Choose a JPG or PNG photo."),
  base64: z.string().min(4).max(Math.ceil(MAX_PHOTO_BYTES / 3) * 4, "The photo must be 3 MB or smaller.")
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "Choose the photo again."),
}).strict();
export type PhotoUpload = z.output<typeof photoSchema>;

export function isUploadId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
