import { getPublicJobs } from "@/lib/public-jobs";
import { PageMotion } from "@/components/animations/PageMotion";
import { Hero } from "@/components/home/Hero";
import { JobFairBanner } from "@/components/job-fair/JobFairBanner";
import { site } from "@/data/site";
import { pageMetadata } from "@/lib/seo";
export const metadata = {
  ...pageMetadata({ title: "Job Fair Philippines 2026", description: site.description, path: "/" }),
  title: { absolute: site.title },
};
import {
  Introduction,
  FeaturedJobs,
  Industries,
  Process,
  WhyChooseUs,
  TrustSection,
  HomeFaq,
  FinalCta,
} from "@/components/home/HomeSections";
export const dynamic = "force-dynamic";
export default async function Home() {
  const jobs = await getPublicJobs();
  return (
    <>
      <Hero
        count={jobs.length}
        exampleCount={jobs.filter((job) => job.isExample).length}
        proposedCount={jobs.filter((job) => job.salaryStatus === "proposed-net").length}
        workers={jobs.filter((job) => job.salaryStatus === "proposed-net").reduce((total, job) => total + (job.openings || 0), 0)}
      />
      <div className="container job-fair-banner-wrap"><JobFairBanner /></div>
      <Introduction />
      <FeaturedJobs jobs={jobs.filter((job) => job.featured)} />
      <Industries jobs={jobs} />
      <Process />
      <WhyChooseUs />
      <TrustSection />
      <HomeFaq />
      <FinalCta />
      <PageMotion />
    </>
  );
}
