import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobDetails } from "@/components/jobs/JobDetails";
import { PageMotion } from "@/components/animations/PageMotion";
import { getJobBySlug, getJobs } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) return { title: "Opportunity not found" };
  return {
    title: `${job.title}${job.salaryStatus === "proposed-net" ? " — Proposed role" : job.isExample ? " — Example vacancy" : ""}`,
    description: job.summary,
    alternates: { canonical: `/jobs/${job.slug}` },
    ...(job.isExample || job.salaryStatus === "proposed-net" ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: `${job.title} | Jobs in Croatia`,
      description: job.summary,
      images: [{ url: job.image, alt: job.imageAlt }],
    },
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) notFound();
  const jobs = await getJobs();
  const relatedJobs = jobs
    .filter((item) => item.id !== job.id)
    .sort(
      (a, b) =>
        Number(b.category === job.category) -
        Number(a.category === job.category),
    )
    .slice(0, 3);
  // Example vacancies intentionally omit JobPosting structured data.
  return (
    <>
      <JobDetails job={job} relatedJobs={relatedJobs} />
      <PageMotion />
    </>
  );
}
