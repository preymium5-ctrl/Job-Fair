import type { Metadata } from "next";
import DriverApplicationForm from "@/components/applications/DriverApplicationForm";
import { getDriverJobOptions } from "@/lib/public-jobs";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Czech Republic Licence Check for C/CE Drivers",
  description: "Drivers with a Philippine C and CE licence and an International Driving Permit: send your documents so Tenda Dom can verify truck driving eligibility in the Czech Republic.",
  alternates: { canonical: siteUrl("/apply/drivers/czech-licence-check") },
  robots: { index: false, follow: false },
};

export default async function CzechLicenceCheckPage() {
  const jobs = await getDriverJobOptions();
  // The Czech job order is for trailer drivers; preselect it when it is open.
  return <DriverApplicationForm variant="czech-licence-check" jobs={jobs} defaultJobId="job-order-trailer-driver" />;
}
