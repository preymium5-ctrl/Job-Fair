import { PageMotion } from "@/components/animations/PageMotion";
import { BrandMark } from "@/components/ui/Brand";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ActionLink } from "@/components/ui/ActionLink";
import { jobFair } from "@/data/job-fair";
import { pageMetadata } from "@/lib/seo";
export const metadata: Metadata = pageMetadata({
  title: "About the Philippines Job Fair & Croatia Roles",
  description:
    "Learn about Jobs in Croatia and the Job Fair Philippines 2026 guide, with role information, online applications and preparation for work abroad.",
  path: "/about",
});
export default function About() {
  return (
    <div className="container information-page">
      <div className="breadcrumb" data-enter>
        <Link href="/">Home</Link>
        <span>/</span>
        <span>About Jobs in Croatia</span>
      </div>
      <span className="eyebrow" data-enter>
        People. Possibility. Progress.
      </span>
      <h1 className="page-heading" data-enter>
        Good work.
        <br />A better <span className="subtle-text">future.</span>
      </h1>
      <p className="information-intro" data-enter>
        There’s a person behind every application. A skill worth recognising. An
        ambition worth taking seriously. Jobs in Croatia is built around that idea.
      </p>
      <div className="information-body">
        <aside className="information-side" data-reveal>
          <BrandMark className="brand-spark" />
          <h2>
            Every next
            <br />
            step matters.
          </h2>
          <p>
            Clear details. Room to explore. A simple way to introduce yourself.
          </p>
          <ActionLink href="/jobs">Explore jobs in Croatia</ActionLink>
        </aside>
        <div data-reveal>
          <h2>A clearer way forward.</h2>
          <p>
            Jobs in Croatia brings job information and online applications into one
            place. Discover different industries, understand what a role
            involves, and decide whether it matches your experience and goals.
          </p>
          <h3>Built around your skills</h3>
          <p>
            Explore metal fabrication and welding, motor and generator
            production, electrical work, CNC machining, and industrial finishing.
            Search by skill or employer to find a role that matches your background.
          </p>
          <h3>Job Fair Philippines 2026</h3>
          <p>
            The Humble Hunters × BEI Manpower event plan lists 248 positions
            across six employers: Končar MK, Đuro Đaković Montaža, Končar GIM,
            Vertiv, Novi Ferromont d.o.o., and Ferokotao d.o.o. Online interviews
            are scheduled for {jobFair.interviewDateLabel}, with five days of testing planned for{" "}
            {jobFair.testingDateLabel} in the Philippines.
          </p>
          <Link href="/job-fair" className="text-link">Explore the event guide <ArrowUpRight size={16} /></Link>
          <h3>From discovery to application</h3>
          <p>
            Each opportunity has a dedicated page with responsibilities,
            requirements, and employment information. A guided application form
            lets you introduce yourself, share your background, and securely
            upload a resume.
          </p>
          <h3>Honest information, useful decisions</h3>
          <p>
            Employer allocations, assessments, and document guidance come from
            the event plan dated 29 September 2026.
            The PDF does not provide salary ranges.
            Work locations, benefits, contract terms, and final event arrangements
            remain to be confirmed with the recruitment team.
          </p>
          <h3>Care for your information</h3>
          <p>
            Applications are stored securely, resumes are kept private, and
            authorized recruitment staff manage the review process. The{" "}
            <Link href="/privacy" className="text-link">
              privacy notice <ArrowUpRight size={15} />
            </Link>{" "}
            explains this preview’s data handling.
          </p>
        </div>
      </div>
      <PageMotion />
    </div>
  );
}
