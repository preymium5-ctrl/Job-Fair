import type { Metadata } from "next";
import ApplicationForm from "@/components/applications/ApplicationForm";
import { getApplicationJobOptions } from "@/lib/public-jobs";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "General Application",
  description: "Apply directly with Jobs in Croatia. Choose your preferred position, complete your details, and attach your CV / Resume and supporting documents in one form.",
  alternates: { canonical: siteUrl("/apply") },
  robots: { index: false, follow: false },
};

export default async function GeneralApplyPage() {
  const { jobs, additionalJobs } = await getApplicationJobOptions();
  return <ApplicationForm jobs={jobs} additionalJobs={additionalJobs} />;
}
