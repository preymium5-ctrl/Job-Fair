import type { SupportingDocumentCategory } from "./document-uploads";
import type { destinationCountries } from "../data/application-form-options";
export type JobStatus = "published" | "draft" | "closed";
export interface Job {
  id: string;
  slug: string;
  title: string;
  category: string;
  location: string;
  employmentType: string;
  summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  experience: string;
  image: string;
  imageAlt: string;
  imagePosition?: string;
  postedAt: string;
  status: JobStatus;
  isExample: boolean;
  featured: boolean;
  applicationOnly?: boolean;
  salary?: string;
  salaryStatus?: "proposed-net";
  schedule?: string;
  contract?: string;
  openings?: number;
}
export const applicationStatuses = [
  "New",
  "Under Review",
  "Shortlisted",
  "Interview",
  "Selected",
  "Rejected",
] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];
export const documentStatuses = ["ready", "in-progress", "not-yet"] as const;
export type DocumentStatus = (typeof documentStatuses)[number];
export interface DocumentReadiness {
  nc2: DocumentStatus;
  diploma: DocumentStatus;
  nbi: DocumentStatus;
  form18a: DocumentStatus;
}
export interface ApplicationProfile {
  firstName: string;
  lastName: string;
  gender: "Male" | "Female";
  nationality?: string;
  address: string;
  street?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  dateOfBirth: string;
  placeOfBirth: string;
  destinationCountry: (typeof destinationCountries)[number] | "North Macedonia";
  currentWorkCountry: string;
  secondaryJobTitle: string;
  englishProficiency: "Yes" | "No";
  termsAccepted: boolean;
  telegram?: string;
  fatherName?: string;
  motherName?: string;
  otherJobTitle?: string;
}
export interface ApplicationInput {
  jobId: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  profile?: ApplicationProfile;
  referralSource?: string;
  recentJobTitle: string;
  experienceYears: number | null;
  skills: string;
  education: string;
  summary: string;
  coverLetter: string;
  consent: boolean;
  nc2Certificate?: string;
  driverLicenseDetails?: string;
  documentReadiness?: DocumentReadiness;
  preferredEmployer?: string;
}
export interface ApplicationDocument {
  id: string;
  category: SupportingDocumentCategory;
  name: string;
  key: string;
  mime: string;
  size: number;
}
export interface Application extends ApplicationInput {
  id: string;
  reference: string;
  jobTitle: string;
  status: ApplicationStatus;
  submittedAt: string;
  resumeName: string;
  resumeKey: string;
  resumeMime: string;
  documents?: ApplicationDocument[];
  isExample: boolean;
}
