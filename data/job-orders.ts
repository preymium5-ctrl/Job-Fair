import type { Job } from "../lib/types";

// Job demand received on 31 October 2026 (Humble Hunters, Croatia, 6 positions).
// The salary range was supplied by the site operator as NET EUR per month.
// The employer, worksite, schedule and contract terms are not named in the
// source and remain to be confirmed; no benefits are inferred.
const printingPressOperatorSummary =
  "Operate web offset (coldset) printing presses and take responsibility for the quality of the printed product.";

export const printingPressOperatorJob: Job = {
  id: "job-order-offset-web-printing-press-operator",
  slug: "offset-web-printing-press-operator",
  title: "Offset Web Printing Press Operator (Coldset)",
  category: "Production & Manufacturing",
  location: "Croatia",
  employmentType: "Terms to be confirmed",
  summary: printingPressOperatorSummary,
  description: `${printingPressOperatorSummary} We are hiring 6 experienced press operators for the printing industry in Croatia. The presses are manroland Geoman and manroland Uniset newspaper web presses. The displayed salary range is a NET amount in EUR per month; the employer, workplace, schedule and contract terms will be confirmed by the recruitment team.`,
  responsibilities: [
    "Prepare the presses for operation (make-ready).",
    "Carry out quality control of the printed output.",
    "Control delivered print quantities.",
    "Control paper waste (spoilage).",
    "Troubleshoot and fix minor machine faults.",
    "Cooperate with the print supervisor, production team and press assistant.",
    "Keep the work area clean and orderly.",
  ],
  requirements: [
    "Proven experience as a web offset / coldset press operator.",
    "Senior level: 5+ years of experience.",
    "Hands-on experience on manroland Geoman or manroland Uniset presses (or comparable newspaper / coldset web presses) is a strong advantage.",
    "Precision, technical knowledge and responsibility.",
    "Your CV should clearly state the press models you have operated and your years of experience on each.",
  ],
  benefits: [],
  experience: "Minimum 5 years as a web offset / coldset press operator",
  image: "/images/jobs/categories/production-manufacturing.webp",
  imageAlt: "Male professional in a representative production and manufacturing workplace",
  imagePosition: "center",
  postedAt: "2026-10-31T00:00:00.000Z",
  status: "published",
  isExample: false,
  featured: false,
  salary: "€850–€1,000",
  salaryStatus: "proposed-net",
  openings: 6,
};

export const jobOrderJobs: Job[] = [printingPressOperatorJob];
