import { getPublicJobs } from "@/lib/public-jobs";
import { PageMotion } from "@/components/animations/PageMotion";
import { Hero } from "@/components/home/Hero";
import { CommunityMarquees } from "@/components/home/CommunityMarquees";
import { RecruitmentSummary } from "@/components/jobs/EmploymentBenefits";
import { site } from "@/data/site";
import { pageMetadata } from "@/lib/seo";
export const metadata = {
  ...pageMetadata({ title: "Hiring Skilled Workers in the Philippines", description: site.description, path: "/" }),
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
      />
      <RecruitmentSummary />
      <Introduction />
      <CommunityMarquees />
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
