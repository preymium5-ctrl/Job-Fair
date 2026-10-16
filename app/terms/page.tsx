import type { Metadata } from "next";
import Link from "next/link";
import { applicationTermsSections, applicationTermsUpdated, applicationTermsVersion } from "@/data/application-terms";

export const metadata: Metadata = {
  title: "Application terms",
  description: "Read the application terms for Jobs in Croatia, including eligibility, CV uploads, recruitment review and privacy.",
  alternates: { canonical: "/terms" },
  robots: { index: false, follow: true },
};

export default function Terms() {
  return (
    <div className="container information-page">
      <div className="breadcrumb">
        <Link href="/">Home</Link><span>/</span><span>Application terms</span>
      </div>
      <span className="eyebrow">Jobs in Croatia / Applications</span>
      <h1 className="page-heading">Application<br /><span className="subtle-text">terms.</span></h1>
      <div className="legal-content">
        <p>These terms explain how to apply for jobs in Croatia through this website. Please read them and the <Link href="/privacy">privacy notice</Link> before submitting your details and documents.</p>
        <p>Updated {applicationTermsUpdated} · Version {applicationTermsVersion}</p>
        {applicationTermsSections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.text}</p>
          </section>
        ))}
        <p>For questions about an application or these terms, visit <Link href="/contact">application help</Link>. Include your application reference if you have one.</p>
        <Link href="/jobs" className="button button-primary">Explore jobs in Croatia</Link>
      </div>
    </div>
  );
}
