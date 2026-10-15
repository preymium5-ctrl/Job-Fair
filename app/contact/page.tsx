import { PageMotion } from "@/components/animations/PageMotion";
import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/ui/Faq";
import { ActionLink } from "@/components/ui/ActionLink";
import { jobFair } from "@/data/job-fair";
import { pageMetadata } from "@/lib/seo";
export const metadata: Metadata = pageMetadata({
  title: "Job Fair Philippines 2026 — Application Help",
  description:
    "Get help with applying, resume uploads, and application confirmation. Find confirmed recruitment contact details when available.",
  path: "/contact",
});
export default function Contact() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <div className="container information-page">
      <div className="breadcrumb" data-enter>
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Application help</span>
      </div>
      <span className="eyebrow" data-enter>
        A little guidance goes a long way
      </span>
      <h1 className="page-heading" data-enter>
        Let’s move
        <br />
        <span className="subtle-text">forward.</span>
      </h1>
      <p className="information-intro" data-enter>
        Help with your next step, from choosing a role to submitting your
        application.
      </p>
      <div className="help-grid">
        <div data-reveal>
          <Faq />
        </div>
        <aside className="help-panel" data-reveal>
          <h2>
            Start with
            <br />
            the right details.
          </h2>
          <p>
            Read the opportunity’s responsibilities and requirements. When
            you’re ready, have your CV and contact details to hand.
          </p>
          <ActionLink href="/jobs">Explore opportunities</ActionLink>
          <span className="eyebrow">Recruitment contact</span>
          <p>Humble Hunters × BEI Manpower<br />Job Fair Philippines 2026</p>
          {email ? (
            <>
              <p>
                For application enquiries, include the position title and your
                application reference.
              </p>
              <a className="contact-email" href={`mailto:${email}`}>
                {email}
              </a>
            </>
          ) : (
            <p>
              A recruitment email address or phone number is not provided in
              the event plan. Contact details will appear here when supplied by
              the organizers.
            </p>
          )}
          <span className="eyebrow">Testing & documents</span>
          <p>
            Testing is planned for {jobFair.testingDateLabel}. The testing-centre address
            is to be confirmed. Start with your CV; work permit documents are
            prepared separately for a later stage.
          </p>
          <Link href="/job-fair#documents" className="text-link">Read the event guide ↗</Link>
        </aside>
      </div>
      <PageMotion />
    </div>
  );
}
