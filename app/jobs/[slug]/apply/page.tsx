import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ApplicationForm from "@/components/applications/ApplicationForm";
import { getPublicJobBySlug, getPublicJobs, usesPublishedCatalog } from "@/lib/public-jobs";
import { siteUrl } from "@/lib/seo";
import { additionalApplicationJobOptions } from "@/data/application-jobs";
import { getJobs } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await getPublicJobBySlug(slug);
  return {
    title: job ? `Apply for ${job.title}` : "Application",
    description: job
      ? `Apply for ${job.title} with Jobs in Croatia. Complete your personal details, experience and qualifications, then attach your CV / Resume and supporting documents.`
      : "Complete your job application with Jobs in Croatia.",
    alternates: { canonical: siteUrl(`/jobs/${encodeURIComponent(slug)}/apply`) },
    robots: { index: false, follow: false },
  };
}

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await getPublicJobBySlug(slug);
  if (!job || job.status !== "published") notFound();
  const jobs = (await getPublicJobs())
    .filter((item) => item.status === "published")
    .map(({ id, title, slug }) => ({ id, title, slug }));
  const officialTitles = new Set(jobs.map(({ title }) => title.toLowerCase()));
  const availableAdditionalJobs = usesPublishedCatalog() ? additionalApplicationJobOptions
    : (await getJobs({ includeApplicationOnly: true })).filter(({ applicationOnly }) => applicationOnly);
  const additionalJobs = availableAdditionalJobs.filter(({ title }) => !officialTitles.has(title.toLowerCase()))
    .map(({ id, title, slug }) => ({ id, title, slug }));
  return <ApplicationForm key={job.id} job={job} jobs={jobs} additionalJobs={additionalJobs} />;
}
