import type { Job } from "../lib/types";

// One position per employer row on page 4 of the supplied job-fair plan.
// Keep the original 17 IDs and URLs so existing applications remain linked.
export const jobPositions = [
  { slug: "fabricator", roleSlug: "fabricator", employer: "Končar MK", number: 1 },
  { slug: "tig-rel-welder", roleSlug: "tig-rel-welder", employer: "Đuro Đaković Montaža", number: 2 },
  { slug: "pipe-fitter", roleSlug: "pipe-fitter", employer: "Đuro Đaković Montaža", number: 3 },
  { slug: "mg-winding-insulator", roleSlug: "mg-winding-insulator", employer: "Končar GIM", number: 4 },
  { slug: "mg-winding-production-worker", roleSlug: "mg-winding-production-worker", employer: "Končar GIM", number: 5 },
  { slug: "mg-winding-processing-worker", roleSlug: "mg-winding-processing-worker", employer: "Končar GIM", number: 6 },
  { slug: "sheet-metal-tinsmith-processor", roleSlug: "sheet-metal-tinsmith-processor", employer: "Končar GIM", number: 7 },
  { slug: "mg-assembly-fitter", roleSlug: "mg-assembly-fitter", employer: "Končar GIM", number: 8 },
  { slug: "mig-mag-tig-rel-welder", roleSlug: "mig-mag-tig-rel-welder", employer: "Končar GIM", number: 9 },
  { slug: "electrical-installer", roleSlug: "electrical-installer", employer: "Vertiv", number: 10 },
  { slug: "electrical-assembler", roleSlug: "electrical-assembler", employer: "Vertiv", number: 11 },
  { slug: "welder", roleSlug: "welder", employer: "Vertiv", number: 12 },
  { slug: "mig-mag-tig-welder", roleSlug: "mig-mag-tig-welder", employer: "Novi Ferromont d.o.o.", number: 13 },
  { slug: "cnc-operator", roleSlug: "cnc-operator", employer: "Novi Ferromont d.o.o.", number: 14 },
  { slug: "industrial-spray-painter", roleSlug: "industrial-spray-painter", employer: "Novi Ferromont d.o.o.", number: 15 },
  { slug: "robotic-welding-machine-operator", roleSlug: "robotic-welding-machine-operator", employer: "Ferokotao d.o.o.", number: 16 },
  { slug: "grinder-and-cleaner", roleSlug: "grinder-and-cleaner", employer: "Ferokotao d.o.o.", number: 17 },
  { slug: "fabricator-vertiv", roleSlug: "fabricator", employer: "Vertiv", number: 18 },
  { slug: "fabricator-novi-ferromont", roleSlug: "fabricator", employer: "Novi Ferromont d.o.o.", number: 19 },
  { slug: "fabricator-ferokotao", roleSlug: "fabricator", employer: "Ferokotao d.o.o.", number: 20 },
  { slug: "mig-mag-tig-rel-welder-ferokotao", roleSlug: "mig-mag-tig-rel-welder", employer: "Ferokotao d.o.o.", number: 21 },
  { slug: "cnc-operator-ferokotao", roleSlug: "cnc-operator", employer: "Ferokotao d.o.o.", number: 22 },
  { slug: "industrial-spray-painter-ferokotao", roleSlug: "industrial-spray-painter", employer: "Ferokotao d.o.o.", number: 23 },
].map((position) => ({
  ...position,
  id: `proposed-${position.slug}-${String(position.number).padStart(2, "0")}`,
}));

/** Do not attach source-controlled employer facts to unrelated staff records. */
export function getJobPosition(job: Pick<Job, "id" | "slug">) {
  return jobPositions.find((position) => position.id === job.id && position.slug === job.slug);
}

export function jobPositionLabel(job: Pick<Job, "id" | "slug" | "title">) {
  const position = getJobPosition(job);
  return position ? `${job.title} — ${position.employer}` : job.title;
}
