import { PageMotion } from "@/components/animations/PageMotion";
import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight } from "lucide-react";
import { getJobs } from "@/lib/repository";
import { JobDirectory } from "@/components/jobs/JobDirectory";
import { ProposedTermsNotice } from "@/components/jobs/JobSalary";
import { JobFairBanner } from "@/components/job-fair/JobFairBanner";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Find your next opportunity",
  description:
    "Explore jobs by industry, location, and employment type. Read complete role details and start your online application.",
  alternates: { canonical: "/jobs" },
};
export default async function JobsPage() {
  const jobs = await getJobs();
  const proposedJobs = jobs.filter((job) => job.salaryStatus === "proposed-net");
  const workers = proposedJobs.reduce((total, job) => total + (job.openings || 0), 0);
  return (
    <>
      <section className="container jobs-hero">
        <div className="breadcrumb" data-enter>
          <Link href="/">Home</Link>
          <span>/</span>
          <span>Opportunities</span>
        </div>
        <div className="jobs-hero-layout">
          <div>
            <span className="eyebrow" data-enter>
              Your skills deserve the right place
            </span>
            <h1 className="page-heading" data-enter>
              Find your next
              <br />
              <span className="subtle-text">opportunity.</span>
            </h1>
            <p data-enter>
              New possibilities. Different directions.
              <br />
              Find work that matches your skills and ambitions.
            </p>
          </div>
          <div className="jobs-hero-photo" data-enter>
            <Image
              src="/images/intro.jpg"
              alt="A professional work environment"
              fill
              loading="eager"
              fetchPriority="high"
              sizes="(max-width:800px) 100vw, 30vw"
            />
            <div className="jobs-photo-tag">
              <span>{String(jobs.length).padStart(2, "0")}</span>
              <div>
                {proposedJobs.length === jobs.length ? "Proposed roles" : "Published opportunities"}
                <br />
                {proposedJobs.length > 0
                  ? `${workers} workers proposed`
                  : jobs.every((j) => j.isExample)
                  ? "Example vacancies"
                  : "Explore what’s next"}
              </div>
              <ArrowDownRight size={28} />
            </div>
          </div>
        </div>
      </section>
      <div className="container job-fair-banner-wrap"><JobFairBanner /></div>
      <div className="container">
        {proposedJobs.length > 0 && <ProposedTermsNotice />}
        {jobs.some((j) => j.isExample) && (
          <div className="sample-notice">
            <span className="status-dot" /> Example vacancies are for this
            development preview. No employer openings, compensation, or benefits
            are confirmed.
          </div>
        )}
      </div>
      <Suspense
        fallback={
          <div className="container loading-page">Loading opportunities…</div>
        }
      >
        <JobDirectory jobs={jobs} />
      </Suspense>
      <PageMotion />
    </>
  );
}
