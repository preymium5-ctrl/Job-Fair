import type { Job } from "../lib/types";
import { proposedJobs } from "./jobs";
import { addedApplicationRoleDestination, addedApplicationRoleTitles, applicantRequestedJobRoles, referenceJobPositions, secondaryJobPositions } from "./application-form-options";
import type { ApplicantRequestedSector } from "./application-form-options";
import { applicationRoleDestination, getApplicationRoleTerms } from "./application-role-catalog";
import { jobOrderJobs, retiredApplicationRoles } from "./job-orders";

const retiredTitles = new Set<string>(retiredApplicationRoles.map(({ title }) => title));

// Preserve the original form-only snapshot for field-by-field database upgrades.
// Job-order roles have their own full listing, so a form choice with the same title is not duplicated.
const officialTitles = new Set([...proposedJobs, ...jobOrderJobs].map(({ title }) => title.toLowerCase()));
export const previousAdditionalApplicationJobs: Job[] = referenceJobPositions
  .filter((title) => title !== "Other (enter below)" && title !== "No other position" && !officialTitles.has(title.toLowerCase()))
  .map((title) => {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return {
      id: `additional-${slug}`, slug: `additional-${slug}`, title,
      category: "Other jobs we’re offering", applicationOnly: true,
      location: "Location to be confirmed", employmentType: "Terms to be confirmed",
      summary: `Apply for ${title}.`,
      description: "Submit your experience for recruitment review. The employer, location, salary, and final terms will be confirmed by the recruitment team.",
      responsibilities: [], requirements: [], benefits: [],
      experience: "Relevant work experience", image: "", imageAlt: "",
      postedAt: "2026-10-20T00:00:00.000Z", status: "published", isExample: false, featured: false,
    };
  });

const addedTitles = new Set<string>(addedApplicationRoleTitles);
const buildAdditionalApplicationJobs = (useRotatedDestinationsOnly: boolean): Job[] => [...new Set([...referenceJobPositions, ...secondaryJobPositions])]
  .filter((title) => title !== "Other (enter below)" && title !== "No other position" && !officialTitles.has(title.toLowerCase()))
  .map((title, index) => {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const terms = getApplicationRoleTerms(title);
    const location = !useRotatedDestinationsOnly && addedTitles.has(title) ? addedApplicationRoleDestination : applicationRoleDestination(index);
    const amount = (value: number) => `€${value.toLocaleString("en-US")}`;
    return {
      id: `additional-${slug}`, slug: `additional-${slug}`, title,
      category: terms.category, location, employmentType: "Terms to be confirmed",
      summary: terms.summary,
      description: `${terms.summary} Apply for ${title} in ${location}. The displayed NET monthly salary range and available slots are operator-supplied proposals. The employer, specific workplace, contract, schedule, and final terms will be confirmed by the recruitment team.`,
      responsibilities: terms.responsibilities,
      requirements: ["Describe your relevant work experience and skills for recruitment review.", "Final duties, qualifications, and any professional registration or trade tests are subject to employer confirmation."],
      benefits: [], experience: "Relevant work experience to be reviewed",
      image: terms.image,
      imageAlt: `Male professional in a representative ${terms.category.toLowerCase()} workplace`,
      imagePosition: "center",
      postedAt: "2026-10-20T00:00:00.000Z", status: retiredTitles.has(title) ? "closed" : "published", isExample: false, featured: false,
      salary: `${amount(terms.minimum)}–${amount(terms.maximum)}`,
      salaryStatus: "proposed-net", openings: terms.openings,
    };
  });

// Promote the form's specific positions using the operator's display proposals.
// Keep all established IDs/URLs so submitted applications retain their linkage.
export const additionalApplicationJobs: Job[] = buildAdditionalApplicationJobs(false);

/** The 9 November 2026 roles as first published with rotated destinations, so stored copies update only where staff have not edited them. */
export const addedApplicationJobsV1: Job[] = buildAdditionalApplicationJobs(true).filter(({ title }) => addedTitles.has(title));

// Positions applicants asked for (19 November 2026): form choices with no public
// listing, salary or slots. A title that is already a role is never duplicated.
const listedTitles = new Set([...officialTitles, ...additionalApplicationJobs.map(({ title }) => title.toLowerCase())]);
// Each sector borrows an existing catalog category name and image.
const requestedSectors: Record<ApplicantRequestedSector, { category: string; image: string }> = {
  agriculture: { category: "Agriculture & Food Processing", image: "/images/jobs/categories/agriculture-food-processing.webp" },
  automotive: { category: "Automotive & Vehicle Maintenance", image: "/images/jobs/categories/automotive-vehicle-maintenance.webp" },
  construction: { category: "Construction & Building Trades", image: "/images/jobs/categories/construction-building-trades.webp" },
  electrical: { category: "Electrical", image: "/images/male-workers/electrical-installer.webp" },
  facilities: { category: "Cleaning & Facilities", image: "/images/male-workers/cleaner.webp" },
  healthcare: { category: "Healthcare & Dental", image: "/images/jobs/categories/healthcare-dental.webp" },
  hospitality: { category: "Hospitality & Food Service", image: "/images/jobs/categories/hospitality-food-service.webp" },
  machining: { category: "CNC & Machining", image: "/images/male-workers/cnc-operator.webp" },
  maritime: { category: "Maritime & Yacht Services", image: "/images/jobs/categories/maritime-yacht-services.webp" },
  metal: { category: "Metal Fabrication & Welding", image: "/images/male-workers/fabricator.webp" },
  production: { category: "Production & Manufacturing", image: "/images/jobs/categories/production-manufacturing.webp" },
  sales: { category: "Design, Sales & Media", image: "/images/jobs/categories/design-sales-media.webp" },
  transport: { category: "Transport & Logistics", image: "/images/jobs/categories/transport-logistics.webp" },
};
export const applicantRequestedApplicationJobs: Job[] = applicantRequestedJobRoles
  .filter(([title]) => !listedTitles.has(title.toLowerCase()))
  .map(([title, sector]) => {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { category, image } = requestedSectors[sector];
    return {
      id: `additional-${slug}`, slug: `additional-${slug}`, title, category, applicationOnly: true,
      location: "Location to be confirmed", employmentType: "Terms to be confirmed",
      summary: `Apply for ${title}.`,
      description: "Submit your experience for recruitment review. The employer, location, salary, and final terms will be confirmed by the recruitment team.",
      responsibilities: ["Duties will be confirmed by the employer and the recruitment team."],
      requirements: ["Describe your relevant work experience and skills for recruitment review."],
      benefits: [], experience: "Relevant work experience to be reviewed",
      image, imageAlt: `Representative ${category.toLowerCase()} workplace`,
      postedAt: "2026-11-19T00:00:00.000Z", status: "published", isExample: false, featured: false,
    };
  });

export const additionalApplicationJobOptions = [...additionalApplicationJobs, ...applicantRequestedApplicationJobs]
  .filter(({ status }) => status === "published").map(({ id, title, slug }) => ({ id, title, slug }));

export const publishedCatalogJobs: Job[] = [...proposedJobs, ...additionalApplicationJobs, ...jobOrderJobs, ...applicantRequestedApplicationJobs];
