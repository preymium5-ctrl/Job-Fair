import { z } from "zod";
import { referralSources } from "./referral-sources";
import { applicationDestinationCountries } from "../data/application-form-options";
import { isDriverPosition } from "./document-uploads";

/**
 * Driver-only application. It is delivered to its own "Driver Applications" tab,
 * separate from the general Applications tracker, so its columns can describe
 * licences and permits instead of trade certificates.
 */
export const DRIVER_FORM_VERSION = "driver-v1";
export const driverFormVariants = ["driver", "czech-licence-check"] as const;
export type DriverFormVariant = (typeof driverFormVariants)[number];
export const driverFormLabels: Record<DriverFormVariant, string> = {
  driver: "Driver application",
  "czech-licence-check": "Czech licence check (Tenda Dom)",
};

/** Philippine LTO licence codes (2021 system). */
export const philippineLicenseCategories = ["A", "A1", "B", "B1", "B2", "BE", "C", "CE", "D"] as const;
export type PhilippineLicenseCategory = (typeof philippineLicenseCategories)[number];
export const czechTruckCategories = ["C", "CE"] as const;

/**
 * Each upload box accepts several files. All files together may total 30 MB;
 * a single file may be 10 MB (photos are resized in the browser first). The
 * Google receiver enforces the same limits.
 */
export const DRIVER_MAX_TOTAL_BYTES = 30 * 1024 * 1024;
export const DRIVER_MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Multipart envelope for staged uploads: the files plus form fields and boundaries. */
export const DRIVER_MAX_ENVELOPE_BYTES = 32 * 1024 * 1024;
export const driverUploadFields = [
  { field: "document:license-front", category: "license-front", maxFiles: 3 },
  { field: "document:license-back", category: "license-back", maxFiles: 3 },
  { field: "document:idp", category: "idp", maxFiles: 20 },
  { field: "resume", category: "cv", maxFiles: 1 },
] as const;
export type DriverUploadField = (typeof driverUploadFields)[number]["field"];
export const DRIVER_FILE_LIMITS: Record<string, number> = Object.fromEntries(driverUploadFields.map(({ field, maxFiles }) => [field, maxFiles]));

export function holdsCzechTruckCategories(categories: readonly string[]) {
  return czechTruckCategories.every((category) => categories.includes(category));
}

export function meetsCzechRequirement(input: { licenseCategories: readonly string[]; hasIdp: string }) {
  return holdsCzechTruckCategories(input.licenseCategories) && input.hasIdp === "Yes";
}

/** File fields that must be attached for this answer set (excluding the optional CV). */
export function requiredDriverDocumentFields(input: { variant: DriverFormVariant; shareWithTendaDom: boolean; hasIdp: string }) {
  const required: DriverUploadField[] = ["document:license-front", "document:license-back"];
  if (input.variant === "czech-licence-check" || input.shareWithTendaDom || input.hasIdp === "Yes") required.push("document:idp");
  return required;
}

export function isDriverApplicationPayload(value: unknown): value is { form: typeof DRIVER_FORM_VERSION } {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).form === DRIVER_FORM_VERSION);
}

export { isDriverPosition };

const text = (maximum: number) => z.string().trim().max(maximum).regex(/^[^\x00-\x08\x0b\x0c\x0e-\x1f\x7f]*$/, "Remove unsupported control characters.");
const required = (maximum: number) => text(maximum).min(1, "Complete this field.");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date as YYYY-MM-DD.").refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a real date.");
const today = () => new Date().toISOString().slice(0, 10);

export const driverApplicationSchema = z.object({
  form: z.literal(DRIVER_FORM_VERSION),
  variant: z.enum(driverFormVariants),
  jobId: z.string().trim().min(1, "Choose the driver position you are applying for.").max(100),
  firstName: required(60),
  lastName: required(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  phone: z.string().trim().min(7, "Enter your WhatsApp number.").max(30)
    .regex(/^[+\d\s().-]+$/, "Enter a valid contact number.")
    .refine((value) => value.replace(/\D/g, "").length >= 7, "Enter at least 7 digits."),
  telegram: text(80).default(""),
  dateOfBirth: isoDate.refine((value) => value < today(), "Enter a real date of birth in the past."),
  currentCountry: required(80),
  currentLocation: required(140),
  destinationCountry: z.enum(applicationDestinationCountries, { error: "Select a destination country." }),
  licenseCategories: z.array(z.enum(philippineLicenseCategories)).min(1, "Select the categories on your licence.").max(philippineLicenseCategories.length)
    .refine((values) => new Set(values).size === values.length, "Select each category once.")
    .transform((values) => philippineLicenseCategories.filter((category) => values.includes(category))),
  licenseExpiry: isoDate.refine((value) => value > today(), "Your Philippine licence must still be valid."),
  drivingExperienceYears: z.number({ error: "Enter your years of professional driving experience." }).int("Enter whole years.").min(0).max(50),
  hasIdp: z.enum(["Yes", "No"], { error: "Please select Yes or No." }),
  idpExpiry: z.string().default(""),
  shareWithTendaDom: z.boolean(),
  englishProficiency: z.enum(["Yes", "No"], { error: "Please select Yes or No." }),
  referralSource: z.string().trim().refine((value) => referralSources.some((source) => source === value), "Choose where you found us."),
  termsAccepted: z.literal(true, { error: "Accept the terms to submit." }),
  consent: z.literal(true, { error: "Acknowledge the privacy notice to submit." }),
}).strict().superRefine((value, context) => {
  if (value.hasIdp === "Yes") {
    const parsed = isoDate.safeParse(value.idpExpiry);
    if (!parsed.success) context.addIssue({ code: "custom", path: ["idpExpiry"], message: "Enter the expiry date shown on your IDP." });
    else if (value.idpExpiry <= today()) context.addIssue({ code: "custom", path: ["idpExpiry"], message: "Your International Driving Permit must still be valid." });
  } else if (value.idpExpiry) context.addIssue({ code: "custom", path: ["idpExpiry"], message: "Remove the IDP expiry date or select Yes." });
  if (value.variant === "czech-licence-check") {
    if (!holdsCzechTruckCategories(value.licenseCategories))
      context.addIssue({ code: "custom", path: ["licenseCategories"], message: "This check is for drivers whose Philippine licence includes both C and CE." });
    if (value.hasIdp !== "Yes")
      context.addIssue({ code: "custom", path: ["hasIdp"], message: "This check requires an International Driving Permit issued in the Philippines." });
    if (!value.shareWithTendaDom)
      context.addIssue({ code: "custom", path: ["shareWithTendaDom"], message: "Agree to share your documents with Tenda Dom to continue." });
  }
  if (value.shareWithTendaDom && !meetsCzechRequirement(value))
    context.addIssue({ code: "custom", path: ["shareWithTendaDom"], message: "Document sharing applies only to drivers with C, CE and an IDP." });
});
export type DriverApplicationInput = z.input<typeof driverApplicationSchema>;
export type DriverApplication = z.output<typeof driverApplicationSchema>;
