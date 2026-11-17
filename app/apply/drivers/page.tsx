import type { Metadata } from "next";
import DriverApplicationForm from "@/components/applications/DriverApplicationForm";
import { getDriverJobOptions } from "@/lib/public-jobs";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Driver Application",
  description: "Apply for trailer, truck, bus, van and delivery driver jobs with Jobs in Croatia. Share your licence categories, driving experience and International Driving Permit.",
  alternates: { canonical: siteUrl("/apply/drivers") },
  robots: { index: false, follow: false },
};

export default async function DriverApplyPage() {
  const jobs = await getDriverJobOptions();
  return <DriverApplicationForm variant="driver" jobs={jobs} />;
}
