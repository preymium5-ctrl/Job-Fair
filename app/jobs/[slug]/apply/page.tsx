import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ApplicationForm from "@/components/applications/ApplicationForm";
import { getJobBySlug } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  return {
    title: job ? `Apply for ${job.title}` : "Application",
    robots: { index: false, follow: false },
  };
}

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job || job.status !== "published") notFound();
  return <ApplicationForm job={job} />;
}
