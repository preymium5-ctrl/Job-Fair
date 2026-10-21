import type { Job } from "../lib/types";
import { proposedJobs } from "./jobs";
import { referenceJobPositions, secondaryJobPositions } from "./application-form-options";
import { applicationRoleDestination, getApplicationRoleTerms } from "./application-role-catalog";

// Preserve the original form-only snapshot for field-by-field database upgrades.
const officialTitles = new Set(proposedJobs.map(({ title }) => title.toLowerCase()));
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

// Promote the form's specific positions using the operator's display proposals.
// Keep all established IDs/URLs so submitted applications retain their linkage.
export const additionalApplicationJobs: Job[] = [...new Set([...referenceJobPositions, ...secondaryJobPositions])]
  .filter((title) => title !== "Other (enter below)" && title !== "No other position" && !officialTitles.has(title.toLowerCase()))
  .map((title, index) => {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const terms = getApplicationRoleTerms(title);
    const location = applicationRoleDestination(index);
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
      postedAt: "2026-10-20T00:00:00.000Z", status: "published", isExample: false, featured: false,
      salary: `${amount(terms.minimum)}–${amount(terms.maximum)}`,
      salaryStatus: "proposed-net", openings: terms.openings,
    };
  });

export const additionalApplicationJobOptions = additionalApplicationJobs.map(({ id, title, slug }) => ({ id, title, slug }));

export const publishedCatalogJobs: Job[] = [...proposedJobs, ...additionalApplicationJobs];
