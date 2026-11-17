import { createHmac } from "node:crypto";
import { driverFormLabels, meetsCzechRequirement, type DriverApplication } from "./driver-applications";
import { sendDriverApplicationToSheets, type DriverSheetsPayload, type DriverSheetsTransport } from "./sheets-transport";
import type { Job } from "./types";

export interface DriverUpload {
  field: string;
  name: string;
  mime: string;
  bytes: Buffer;
}

/** Google Sheets and private Drive are the durable record for driver submissions. */
export async function saveDriverApplicationToGoogle(
  input: DriverApplication,
  job: Pick<Job, "id" | "title">,
  submissionKey: string,
  requestHash: string,
  uploads: DriverUpload[],
  transport: DriverSheetsTransport = sendDriverApplicationToSheets,
) {
  // The ID stays the same for a retry; the reference binds the entire validated request.
  const id = `dr-${submissionKey}`;
  const reference = `DR-${createHmac("sha256", process.env.GOOGLE_SHEETS_WEBHOOK_SECRET!)
    .update(`driver-application-v1\0${submissionKey}\0${requestHash}`).digest("hex").slice(0, 24).toUpperCase()}`;
  const payload: DriverSheetsPayload = {
    kind: "driver-application",
    version: 1,
    application: {
      id, reference, submittedAt: new Date().toISOString(), form: driverFormLabels[input.variant],
      jobId: job.id, jobTitle: job.title,
      firstName: input.firstName, lastName: input.lastName, fullName: `${input.firstName} ${input.lastName}`,
      email: input.email, phone: input.phone, telegram: input.telegram,
      dateOfBirth: input.dateOfBirth, currentCountry: input.currentCountry, currentLocation: input.currentLocation,
      destinationCountry: input.destinationCountry, licenseCategories: input.licenseCategories.join(", "),
      licenseExpiry: input.licenseExpiry, drivingExperienceYears: input.drivingExperienceYears,
      hasIdp: input.hasIdp, idpExpiry: input.idpExpiry,
      meetsCzechRequirement: meetsCzechRequirement(input) ? "Yes" : "No",
      shareWithTendaDom: input.shareWithTendaDom ? "Yes" : "No",
      englishProficiency: input.englishProficiency, referralSource: input.referralSource,
      termsAccepted: true, consent: true, applicationSource: "Jobs in Croatia",
    },
    documents: uploads.map(({ field, name, mime, bytes }) => {
      const category = field === "resume" ? "cv" : field.replace(/^document:/, "");
      return { id: `${id}-${category}`, category, name, mime, base64: bytes.toString("base64") };
    }),
  };
  const acknowledgement = await transport(payload, { timeoutMs: 100_000 });
  // Never show a success/reference until the durable receiver confirms this record.
  if (acknowledgement.ok !== true || acknowledgement.applicationId !== id || acknowledgement.reference !== reference ||
      !Number.isSafeInteger(acknowledgement.row) || acknowledgement.row < 2 || typeof acknowledgement.duplicate !== "boolean")
    throw new Error("INVALID_APPLICATION_ACKNOWLEDGEMENT");
  return { reference, jobTitle: job.title, duplicate: acknowledgement.duplicate };
}
