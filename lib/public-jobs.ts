import { cache } from "react";
import { additionalApplicationJobOptions, publishedCatalogJobs } from "../data/application-jobs";
import { getJobBySlug, getJobs } from "./repository";

/** The public fair guide can run without a database; applicant/staff data never uses this fallback. */
export function usesPublishedCatalog(env: Record<string, string | undefined> = process.env) {
  return !env.DATABASE_URL && env.NODE_ENV === "production" && env.CHAPTER_LOCAL_MODE !== "true";
}

export const getPublicJobs = cache(async () => {
  if (!usesPublishedCatalog()) return getJobs();
  return publishedCatalogJobs.filter((job) => job.status === "published" && !job.isExample && !job.applicationOnly);
});

export const getPublicJobBySlug = cache(async (slug: string) => {
  if (!usesPublishedCatalog()) return getJobBySlug(slug);
  return (await getPublicJobs()).find((job) => job.slug === slug);
});

export const getApplicationJobOptions = cache(async () => {
  const jobs = (await getPublicJobs())
    .filter((job) => job.status === "published")
    .map(({ id, title, slug }) => ({ id, title, slug }));
  const officialTitles = new Set(jobs.map(({ title }) => title.toLowerCase()));
  const availableAdditionalJobs = usesPublishedCatalog() ? additionalApplicationJobOptions
    : (await getJobs({ includeApplicationOnly: true })).filter(({ applicationOnly }) => applicationOnly);
  const additionalJobs = availableAdditionalJobs
    .filter(({ title }) => !officialTitles.has(title.toLowerCase()))
    .map(({ id, title, slug }) => ({ id, title, slug }));
  return { jobs, additionalJobs };
});
