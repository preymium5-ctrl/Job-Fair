import type { Job } from "../lib/types";

// Job demand received on 31 October 2026 (Humble Hunters, Croatia).
// The operator set the displayed slots to 100 on 31 October 2026.
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
  description: `${printingPressOperatorSummary} We are hiring experienced press operators for the printing industry in Croatia. The presses are manroland Geoman and manroland Uniset newspaper web presses. The displayed salary range is a NET amount in EUR per month; the employer, workplace, schedule and contract terms will be confirmed by the recruitment team.`,
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
  image: "/images/jobs/offset-web-printing-press-operator-20261031.webp",
  imageAlt: "AI-generated illustration of a Filipino coldset web offset printing press operator inspecting a newspaper beside an industrial newspaper press",
  imagePosition: "center",
  postedAt: "2026-10-31T00:00:00.000Z",
  status: "published",
  isExample: false,
  featured: false,
  salary: "€850–€1,000",
  salaryStatus: "proposed-net",
  openings: 100,
};

// Job order added on 6 November 2026 at the site operator's request:
// trailer drivers with 5–10 years of experience at €2,000 NET per month.
// 50 positions. The employer, worksite, routes, schedule and contract
// terms were not supplied and remain to be confirmed; no benefits are inferred.
const trailerDriverSummary =
  "Drive trailer trucks safely and reliably, delivering loads on time and keeping accurate transport records.";

export const trailerDriverJob: Job = {
  id: "job-order-trailer-driver",
  slug: "trailer-driver",
  title: "Trailer Driver",
  category: "Transport & Logistics",
  location: "Croatia",
  employmentType: "Terms to be confirmed",
  summary: trailerDriverSummary,
  description: `${trailerDriverSummary} We are hiring 50 experienced trailer drivers with 5 to 10 years of driving experience. The displayed salary is a NET amount in EUR per month; the employer, routes, workplace, schedule and contract terms will be confirmed by the recruitment team.`,
  responsibilities: [
    "Check the truck, trailer, coupling and load securing before every trip.",
    "Drive the assigned routes safely and deliver loads on schedule.",
    "Follow traffic laws, driving and rest time rules, and company safety procedures.",
    "Keep delivery documents and transport records accurate and complete.",
    "Report vehicle defects, damage, delays or incidents promptly.",
  ],
  requirements: [
    "5–10 years of experience as a trailer / articulated truck driver.",
    "A valid driver’s license for trailer trucks (upload a copy with your application).",
    "Safe driving record and responsible attitude.",
    "Your CV should clearly state the vehicles you have driven and your years of experience on each.",
  ],
  benefits: [],
  experience: "5–10 years as a trailer truck driver",
  image: "/images/jobs/categories/transport-logistics.webp",
  imageAlt: "Male professional in a representative transport and logistics workplace",
  imagePosition: "center",
  postedAt: "2026-11-06T00:00:00.000Z",
  status: "published",
  isExample: false,
  featured: false,
  salary: "€2,000",
  salaryStatus: "proposed-net",
  openings: 50,
};

export const jobOrderJobs: Job[] = [printingPressOperatorJob, trailerDriverJob];

// Older catalog roles replaced by a job order (6 November 2026: the Trailer
// Driver order replaces "Trailer Truck Driver"). They are closed, not deleted,
// so existing applications keep their linkage and other roles keep their order.
export const retiredApplicationRoles = [
  { id: "additional-trailer-truck-driver", slug: "additional-trailer-truck-driver", title: "Trailer Truck Driver" },
] as const;

/** First published version, kept so stored copies can be updated only where staff have not edited them. */
export const jobOrderJobsV1: Job[] = [{
  ...printingPressOperatorJob,
  description: printingPressOperatorJob.description.replace("We are hiring experienced press operators", "We are hiring 6 experienced press operators"),
  openings: 6,
}];
