import { proposedJobs } from "../data/jobs";
import { getJobFairRole } from "../data/job-fair";
import type { Job } from "./types";

// Private compatibility mapping for records created during the reverted employer
// split. These records remain addressable by applicant history, never public seeds.
export const retiredEmployerPositions = [
  { id: "proposed-fabricator-vertiv-18", slug: "fabricator-vertiv", roleSlug: "fabricator", employer: "Vertiv" },
  { id: "proposed-fabricator-novi-ferromont-19", slug: "fabricator-novi-ferromont", roleSlug: "fabricator", employer: "Novi Ferromont d.o.o." },
  { id: "proposed-fabricator-ferokotao-20", slug: "fabricator-ferokotao", roleSlug: "fabricator", employer: "Ferokotao d.o.o." },
  { id: "proposed-mig-mag-tig-rel-welder-ferokotao-21", slug: "mig-mag-tig-rel-welder-ferokotao", roleSlug: "mig-mag-tig-rel-welder", employer: "Ferokotao d.o.o." },
  { id: "proposed-cnc-operator-ferokotao-22", slug: "cnc-operator-ferokotao", roleSlug: "cnc-operator", employer: "Ferokotao d.o.o." },
  { id: "proposed-industrial-spray-painter-ferokotao-23", slug: "industrial-spray-painter-ferokotao", roleSlug: "industrial-spray-painter", employer: "Ferokotao d.o.o." },
] as const;

/** Retain employer/NC2 context when queued historical applications reach Sheets. */
export function getRetiredEmployerContext(job: Pick<Job, "id" | "slug">) {
  const position = retiredEmployerPositions.find((item) => item.id === job.id && item.slug === job.slug);
  if (!position) return undefined;
  const parent = proposedJobs.find((item) => item.slug === position.roleSlug);
  const fair = parent ? getJobFairRole(parent) : undefined;
  return fair ? { nc2: fair.nc2, employers: fair.employers.filter((item) => item.name === position.employer) } : undefined;
}
