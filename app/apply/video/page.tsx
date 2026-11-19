import type { Metadata } from "next";
import VideoApplicationForm from "@/components/applications/VideoApplicationForm";
import { getApplicationJobOptions } from "@/lib/public-jobs";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Video Application",
  description: "Apply with Jobs in Croatia by sending a short video of yourself doing the work, with your name, age, nationality, position and years of experience.",
  alternates: { canonical: siteUrl("/apply/video") },
  robots: { index: false, follow: false },
};

export default async function VideoApplyPage() {
  const { jobs, additionalJobs } = await getApplicationJobOptions();
  return <VideoApplicationForm jobs={jobs} additionalJobs={additionalJobs} />;
}
