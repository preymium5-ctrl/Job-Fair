import { z } from "zod";
import { applicationStatuses, documentStatuses } from "./types";
import { minimumExperienceYears } from "../data/employment";
import { referralSources } from "./referral-sources";

const shortText = (maximum = 160) =>
  z.string().trim().min(2, "Enter at least 2 characters.").max(maximum);
const profileString = (maximum: number) => z.string().trim().max(maximum).regex(/^[^\x00-\x08\x0b\x0c\x0e-\x1f\x7f]*$/, "Remove unsupported control characters.");
const profileText = (maximum: number) => profileString(maximum).min(1, "Complete this field.");
const profileOptionalText = (maximum: number) => profileString(maximum).optional();
export const applicationProfileSchema = z.object({
  firstName: profileText(60),
  lastName: profileText(60),
  gender: z.enum(["Male", "Female"], { error: "Please select Male or Female." }),
  nationality: profileText(80),
  address: profileText(300),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date as YYYY-MM-DD.").refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value < new Date().toISOString().slice(0, 10);
  }, "Enter a real date of birth in the past."),
  placeOfBirth: profileText(120),
  destinationCountry: z.literal("Croatia"),
  currentWorkCountry: profileText(80).min(2, "Enter your current work country."),
  secondaryJobTitle: profileText(160),
  englishProficiency: z.enum(["Yes", "No"], { error: "Please select Yes or No." }),
  termsAccepted: z.literal(true, { error: "Accept the terms to submit." }),
  telegram: profileOptionalText(80),
  fatherName: profileOptionalText(120),
  motherName: profileOptionalText(120),
  otherJobTitle: profileOptionalText(160),
}).strict();
export const applicationSchema = z
  .object({
    jobId: z.string().trim().min(1).max(100),
    fullName: shortText(120),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address.")
      .max(254),
    phone: z
      .string()
      .trim()
      .min(7)
      .max(30)
      .regex(/^[+\d\s().-]+$/, "Enter a valid contact number.")
      .refine(
        (value) => value.replace(/\D/g, "").length >= 7,
        "Enter at least 7 digits.",
      ),
    country: z.string().trim().max(80).refine((value) => !value || value.length >= 2, "Enter a country name.").default(""),
    profile: applicationProfileSchema.optional(),
    referralSource: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || referralSources.some((source) => source === value),
        "Choose where you heard about us from the list.",
      )
      .transform((value) => value || undefined)
      .optional(),
    recentJobTitle: z.string().trim().max(160).default(""),
    experienceYears: z.number().min(0).max(60).nullable().default(null),
    skills: z.string().trim().max(2000).default(""),
    education: z.string().trim().max(2000).default(""),
    summary: z.string().trim().max(4000).default(""),
    coverLetter: z.string().trim().max(6000).default(""),
    nc2Certificate: z.string().trim().max(200).default(""),
    driverLicenseDetails: z.string().trim().max(200).optional(),
    preferredEmployer: z.string().trim().max(160).default(""),
    documentReadiness: z.object({
      nc2: z.enum(documentStatuses),
      diploma: z.enum(documentStatuses),
      nbi: z.enum(documentStatuses),
      form18a: z.enum(documentStatuses),
    }).strict().optional(),
    consent: z.literal(true, {
      error: "Acknowledge the privacy notice to submit.",
    }),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.profile) {
      if (value.country.length < 2)
        context.addIssue({ code: "custom", path: ["country"], message: "Enter your country of residence." });
      if (value.recentJobTitle.length < 2)
        context.addIssue({ code: "custom", path: ["recentJobTitle"], message: "Enter your most recent role." });
      if (value.experienceYears === null || value.experienceYears < minimumExperienceYears)
        context.addIssue({ code: "custom", path: ["experienceYears"], message: "At least 3 years of relevant work experience is required." });
      if (value.skills.length < 2)
        context.addIssue({ code: "custom", path: ["skills"], message: "Tell us about your relevant skills." });
    }
    if (value.profile && value.fullName !== `${value.profile.firstName} ${value.profile.lastName}`)
      context.addIssue({ code: "custom", path: ["fullName"], message: "Your full name must match your first and last names." });
    if (value.profile && value.summary.length > 1000)
      context.addIssue({ code: "custom", path: ["summary"], message: "Keep your professional summary within 1,000 characters." });
    if (value.documentReadiness?.nc2 === "ready" && value.nc2Certificate.length < 2)
      context.addIssue({ code: "custom", path: ["nc2Certificate"], message: "Enter the name or category of your NC2 certificate." });
  })
  .transform((value) => ({ ...value, country: value.country || value.profile?.currentWorkCountry || "" }));
const imageSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    if (/^\/images\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes(".."))
      return true;
    if (/^\/api\/images\/[a-f0-9-]+\.jpg$/.test(value)) return true;
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" && url.hostname === "images.unsplash.com"
      );
    } catch {
      return false;
    }
  }, "Use a local image, uploaded image, or an Unsplash HTTPS URL.");
const bulletList = z.array(shortText(1000)).min(1).max(30);
export const jobSchema = z
  .object({
    id: z.string().min(1).max(100).optional(),
    slug: z
      .string()
      .min(2)
      .max(180)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use lowercase words separated by hyphens.",
      ),
    title: shortText(160),
    category: shortText(100),
    location: shortText(160),
    employmentType: shortText(100),
    summary: shortText(800),
    description: shortText(15000),
    responsibilities: bulletList,
    requirements: bulletList,
    benefits: z.array(shortText(1000)).max(30),
    experience: shortText(300),
    image: imageSchema,
    imageAlt: shortText(300),
    imagePosition: z
      .string()
      .max(80)
      .regex(
        /^(?:center|top|bottom|left|right|\d{1,3}%)(?: (?:center|top|bottom|left|right|\d{1,3}%))?$/,
      )
      .optional(),
    postedAt: z
      .string()
      .refine(
        (value) =>
          /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) &&
          Number.isFinite(Date.parse(value)),
        "Enter a valid date.",
      ),
    status: z.enum(["published", "draft", "closed"]),
    isExample: z.boolean(),
    featured: z.boolean(),
    salary: z.string().trim().max(300).optional(),
    salaryStatus: z.literal("proposed-net").optional(),
    schedule: z.string().trim().max(300).optional(),
    contract: z.string().trim().max(300).optional(),
    openings: z.number().int().min(1).max(10000).optional(),
  })
  .strict();
export const statusSchema = z
  .object({ status: z.enum(applicationStatuses) })
  .strict();
export function fieldErrors(error: z.ZodError) {
  return Object.fromEntries(
    error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}
