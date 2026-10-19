export const supportingDocumentTypes = [
  { id: "passport", label: "Passport" },
  { id: "residence-id", label: "Residence ID" },
  { id: "diploma", label: "Diploma / education certificate" },
  { id: "employment-certificate", label: "Certificate of employment" },
  { id: "nc2", label: "NC2 certificate" },
  { id: "nbi", label: "NBI clearance / apostille" },
  { id: "form18a", label: "Form 18a" },
  { id: "other", label: "Other supporting document" },
  { id: "driver-license", label: "Driver’s license copy" },
] as const;
export type SupportingDocumentCategory = (typeof supportingDocumentTypes)[number]["id"];
export const requiredProfileDocumentCategories = ["passport", "residence-id", "diploma"] as const;
export const privateProfileDocumentCategories = ["passport", "residence-id", "employment-certificate"] as const;
export const MAX_SUPPORTING_DOCUMENT_BYTES = 3 * 1024 * 1024;
export const MAX_APPLICATION_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_PROFILE_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_PROFILE_RESUME_BYTES = 3 * 1024 * 1024;
export const SUPPORTING_DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png";
export function documentLabel(category: string) {
  return supportingDocumentTypes.find((item) => item.id === category)?.label || "Supporting document";
}
