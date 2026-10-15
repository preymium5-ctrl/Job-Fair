import type { MetadataRoute } from "next";
import { getJobs } from "@/lib/repository";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const jobs = (await getJobs()).filter((j) => !j.isExample && j.salaryStatus !== "proposed-net");
  return ["", "/jobs", "/job-fair", "/about", "/contact"]
    .map((path) => ({ url: base + path }))
    .concat(jobs.map((j) => ({ url: `${base}/jobs/${j.slug}` })));
}
