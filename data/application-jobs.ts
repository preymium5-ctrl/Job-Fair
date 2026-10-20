import type { Job } from "../lib/types";
import { proposedJobs } from "./jobs";
import { referenceJobPositions } from "./application-form-options";

// The linked application form supplies role names, without vacancy counts or pay.
// Keep these roles available for applications without adding unverified job cards.
const officialTitles = new Set(proposedJobs.map(({ title }) => title.toLowerCase()));
export const additionalApplicationJobs: Job[] = referenceJobPositions
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

export const additionalApplicationJobOptions = additionalApplicationJobs.map(({ id, title, slug }) => ({ id, title, slug }));
