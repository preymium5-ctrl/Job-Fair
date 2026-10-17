import { PageMotion } from "@/components/animations/PageMotion";
import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight } from "lucide-react";
import { getPublicJobs } from "@/lib/public-jobs";
import { JobDirectory } from "@/components/jobs/JobDirectory";
import { ProposedTermsNotice } from "@/components/jobs/JobSalary";
import { RecruitmentSummary } from "@/components/jobs/EmploymentBenefits";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbData, jobDirectoryData, pageMetadata } from "@/lib/seo";
export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMetadata({
  title: "Jobs in Croatia — Hiring in the Philippines",
  description:
    "Explore jobs in Croatia for Filipino workers: salary ranges, free transportation and accommodation, no placement fee, and online applications.",
  path: "/jobs",
});
export default async function JobsPage() {
  const jobs = await getPublicJobs();
  const proposedJobs = jobs.filter((job) => job.salaryStatus === "proposed-net");
  const workers = proposedJobs.reduce((total, job) => total + (job.openings || 0), 0);
  return (
    <>
      <JsonLd data={jobDirectoryData(jobs)} />
      <JsonLd data={breadcrumbData([{ name: "Home", path: "/" }, { name: "Jobs abroad", path: "/jobs" }])} />
      <section className="container jobs-hero">
        <div className="breadcrumb" data-enter>
          <Link href="/">Home</Link>
          <span>/</span>
          <span>Opportunities</span>
        </div>
        <div className="jobs-hero-layout">
          <div>
            <span className="eyebrow" data-enter>
              Filipino workers wanted
            </span>
            <h1 className="page-heading" data-enter>
              Find your next
              <br />
              <span className="subtle-text">opportunity.</span>
            </h1>
            <p data-enter>
              Skilled roles in Croatia for Filipino applicants.
              <br />
              Find your trade, check the qualifications, and apply with your CV.
            </p>
          </div>
          <div className="jobs-hero-photo" data-enter>
            <Image
              src="/images/filipino-intro.webp"
              alt="AI-generated illustration of Filipino industrial workers collaborating in a workshop"
              fill
              loading="eager"
              fetchPriority="high"
              sizes="(max-width:800px) 100vw, 30vw"
            />
            <div className="jobs-photo-tag">
              <span>{String(jobs.length).padStart(2, "0")}</span>
              <div>
                {proposedJobs.length === jobs.length ? "Available roles" : "Published opportunities"}
                <br />
                {proposedJobs.length > 0
                  ? `${workers} available ${workers === 1 ? "slot" : "slots"}`
                  : jobs.every((j) => j.isExample)
                  ? "Example vacancies"
                  : "Explore what’s next"}
              </div>
              <ArrowDownRight size={28} />
            </div>
          </div>
        </div>
      </section>
      <RecruitmentSummary />
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
