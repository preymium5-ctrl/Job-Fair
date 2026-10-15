import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, CalendarDays, Check, MapPin } from "lucide-react";
import { PageMotion } from "@/components/animations/PageMotion";
import { ActionLink } from "@/components/ui/ActionLink";
import { BrandMark } from "@/components/ui/Brand";
import {
  fairDocuments,
  fairDocumentTiming,
  fairOptionalDocument,
  jobFair,
  nc2ElectricalNote,
} from "@/data/job-fair";
import styles from "./JobFair.module.css";

export const metadata: Metadata = {
  title: "Job Fair Philippines 2026",
  description:
    `Explore the Job Fair Philippines 2026 plan: 248 positions across six employers, planned testing on ${jobFair.testingDateLabel}, and candidate preparation guidance.`,
  alternates: { canonical: "/job-fair" },
};

const nc2Requirements = [
  ["Fabricators", "NC2 Fabricator"],
  ["Welders", "NC2 Welding"],
  ["Electrical assemblers / installers", "NC2 Electrical*"],
  ["Motor & generator winding", "NC2 Fabricator or Electrical*"],
  ["Motor & generator fitters / assemblers", "NC2 Electrical*"],
  ["CNC operators", "NC2 Fabricator"],
  ["Industrial spray painters", "NC2 Fabricator"],
  ["Grinders", "NC2 Fabricator"],
];

const stages = [
  {
    date: jobFair.interviewDateLabel,
    title: "Apply. Then, introduce yourself.",
    copy: "Choose a role and send your CV through the online application. Daily online interviews are scheduled in the plan to build candidate batches for testing.",
  },
  {
    date: `${jobFair.testingDateLabel} · planned`,
    title: "Show your skills.",
    copy: "Five full testing days are planned in the Philippines, Monday to Friday. Written exams, practical tests, or employer interviews depend on the role. The testing centre and attendance arrangements are to be confirmed.",
  },
  {
    date: "For work permit filing",
    title: "Prepare your documents.",
    copy: "Gather the required certificate and documents for the work permit application. The plan says these do not have to be ready on testing day. BEI Manpower will need to confirm the filing requirements and timing.",
  },
  {
    date: "After assessment",
    title: "Understand your next step.",
    copy: "The employer reviews the assessment. Selection, final employment terms, permit approval, and any deployment arrangements depend on the individual outcome and the applicable process.",
  },
];

const welderStages = [
  {
    title: "TIG in a fixture",
    copy: "The plan specifies TIG welding exclusively in a fixture to simulate a difficult position and prevent weaving, a technique it says is not used in boiler manufacturing.",
  },
  {
    title: "SMAW / REL",
    copy: "A separate SMAW (REL) welding assessment follows in the planned sequence.",
  },
  {
    title: "Combined TIG + REL",
    copy: "Candidates who pass the first two assessments are planned to weld a TIG root pass followed by 1–2 REL passes on a larger pipe, minimum Ø139.7 × 12 mm.",
  },
  {
    title: "Visual inspection",
    copy: "The specified inspection is visual testing (VT). Radiographic testing (RT) is not required in this test outline.",
  },
];

export default function JobFairPage() {
  const workers = jobFair.employers.reduce((total, employer) => total + employer.workers, 0);
  const positions = new Set(jobFair.employers.flatMap((employer) => employer.roles.map((role) => role.slug))).size;

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={`breadcrumb ${styles.breadcrumb}`} data-enter>
          <Link href="/">Home</Link><span>/</span><span>Job Fair 2026</span>
        </div>

        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className="eyebrow" data-enter>Humble Hunters × BEI Manpower</p>
            <h1 className={styles.title} data-enter>Job Fair<br />Philippines<span className={styles.year}>2026.</span></h1>
            <p className={styles.intro} data-enter>A place for your skills.<br />A plan for your future in Croatia.</p>
            <p className={styles.heroDescription} data-enter>Explore the employer groups, prepare for assessment, and find the role that matches your experience.</p>
            <div className={styles.heroActions} data-enter>
              <ActionLink href="/jobs">Explore the roles</ActionLink>
              <Link className={styles.anchorLink} href="#event-details">Event details <ArrowDown size={17} aria-hidden="true" /></Link>
            </div>
          </div>

          <div className={styles.heroVisual} data-enter>
            <div className={styles.imageWrap}>
              <Image src="/images/jobs/proposed/fabricator.webp" alt="AI-generated illustration of a skilled metal fabricator at work" fill sizes="(max-width: 700px) 90vw, 43vw" className={styles.heroImage} />
              <span className={styles.imageLabel}>AI-generated role illustration</span>
              <BrandMark className={styles.imageSpark} />
            </div>
            <div className={styles.dateCard}>
              <span className="eyebrow">Planned testing in the Philippines</span>
              <p>16—20<span>November 2026</span></p>
              <div><CalendarDays size={16} aria-hidden="true" /><span>Monday–Friday · 5 full days</span></div>
            </div>
          </div>
        </header>

        <div className={styles.stats} data-reveal>
          <div><strong>{workers}</strong><span>Workers in the plan</span></div>
          <div><strong>{jobFair.employers.length.toString().padStart(2, "0")}</strong><span>Employer groups</span></div>
          <div><strong>{positions}</strong><span>Role types</span></div>
          <div><strong>05</strong><span>Planned testing days</span></div>
        </div>

        <section id="event-details" className={styles.details} aria-labelledby="details-title">
          <div data-reveal>
            <p className="eyebrow">01 / Save the dates</p>
            <h2 id="details-title" className={styles.heading}>Know what’s<br />coming next.</h2>
          </div>
          <div className={styles.detailsGrid} data-reveal>
            <article className={styles.fact}>
              <CalendarDays size={20} aria-hidden="true" />
              <span>Online interviews</span>
              <h3>{jobFair.interviewDateLabel}</h3>
              <p>Daily interviews are scheduled in the plan to prepare candidate batches for testing.</p>
            </article>
            <article className={styles.fact}>
              <CalendarDays size={20} aria-hidden="true" />
              <span>Planned skills testing</span>
              <h3>{jobFair.testingDateLabel}</h3>
              <p>Monday to Friday. Five full days for the role-specific assessments and interviews.</p>
            </article>
            <article className={styles.fact}>
              <MapPin size={20} aria-hidden="true" />
              <span>Testing location</span>
              <h3>{jobFair.location}</h3>
              <p>{jobFair.venue}. Confirm your appointment and attendance details with BEI Manpower.</p>
            </article>
          </div>
        </section>
      </div>

      <section className={styles.employers} aria-labelledby="employers-title">
        <div className="container">
          <div className={styles.sectionTop} data-reveal>
            <div><p className="eyebrow">02 / The employer groups</p><h2 id="employers-title" className={styles.heading}>Different teams.<br />Shared possibility.</h2></div>
            <p className={styles.sectionIntro}>Six employer groups account for the 248 workers in the supplied plan. Select a role to see its details and apply.</p>
          </div>
          <div className={styles.employerGrid}>
            {jobFair.employers.map((employer, index) => (
              <article className={styles.employerCard} key={employer.name} data-reveal>
                <div className={styles.employerHeading}>
                  <span className={styles.employerIndex}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.workerCount}><strong>{employer.workers}</strong> workers</span>
                </div>
                <h3>{employer.name}</h3>
                <ul className={styles.roleList}>
                  {employer.roles.map((role) => (
                    <li key={role.slug}>
                      <Link href={`/jobs/${role.slug}`}><span>{role.title}</span><span className={styles.roleEnd}><b>{role.workers}</b><ArrowUpRight size={16} aria-hidden="true" /></span></Link>
                    </li>
                  ))}
                </ul>
                <div className={styles.testingNote}><span>Assessment in the plan</span><p>{employer.testing}</p></div>
              </article>
            ))}
          </div>
          <p className={styles.sourceNote}>{jobFair.participationNote}</p>
        </div>
      </section>

      <div className="container">
        <section className={styles.journey} aria-labelledby="journey-title">
          <div className={styles.sectionTop} data-reveal>
            <div><p className="eyebrow">03 / The candidate journey</p><h2 id="journey-title" className={styles.heading}>One step<br />at a time.</h2></div>
            <p className={styles.sectionIntro}>Start with the role that fits you. The type of assessment and the next steps vary by employer.</p>
          </div>
          <ol className={styles.timeline}>
            {stages.map((stage, index) => (
              <li key={stage.title} data-reveal>
                <span className={styles.stageNumber}>{String(index + 1).padStart(2, "0")}</span>
                <div><p className={styles.stageDate}>{stage.date}</p><h3>{stage.title}</h3><p className={styles.stageCopy}>{stage.copy}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section id="documents" className={styles.documents} aria-labelledby="documents-title">
          <div className={styles.documentIntro} data-reveal>
            <p className="eyebrow">04 / Come prepared</p>
            <h2 id="documents-title" className={styles.heading}>Your experience.<br />Your documents.</h2>
            <p className={styles.documentDescription}>The plan lists these documents for work permit filing across all positions.</p>
            <ul className={styles.documentList}>
              {fairDocuments.map((document) => <li key={document}><Check size={18} aria-hidden="true" /><span>{document}</span></li>)}
            </ul>
            <p className={styles.optionalDocument}>{fairOptionalDocument}</p>
            <div className={styles.documentCallout}><strong>Testing day ≠ permit filing</strong><p>{fairDocumentTiming}</p></div>
            <p className={styles.privacyCopy}>Upload your CV when applying. You can also attach your diploma or education certificate, NC2 certificate, NBI clearance, Form 18a, and another relevant supporting document. Supporting uploads are optional and kept private.</p>
          </div>
          <div className={styles.certificatePanel} data-reveal>
            <h3>Which NC2 certificate?</h3>
            <p>The certificate groups listed in the plan.</p>
            <div className={styles.tableWrap}>
              <table className={styles.nc2Table}>
                <thead><tr><th scope="col">Position group</th><th scope="col">Required NC2</th></tr></thead>
                <tbody>{nc2Requirements.map(([position, certificate]) => <tr key={position}><th scope="row">{position}</th><td>{certificate}</td></tr>)}</tbody>
              </table>
            </div>
            <p className={styles.tableFootnote}>*{nc2ElectricalNote}</p>
            <div className={styles.profileNote}><strong>Applying to Vertiv?</strong><p>The plan specifically seeks industrial electricians, rather than lineman or data centre profiles. A broadly accepted electrical certificate does not replace the role’s required industrial knowledge.</p></div>
            <p className={styles.tableFootnote}>Confirm the certificate match for your specific role with BEI Manpower, including roles not separately named in this table.</p>
          </div>
        </section>

        <section className={styles.welder} aria-labelledby="welder-title">
          <div className={styles.sectionTop} data-reveal>
            <div><p className="eyebrow">05 / A closer look at testing</p><h2 id="welder-title" className={styles.heading}>TIG / REL.<br />The planned test.</h2></div>
            <p className={styles.sectionIntro}>For Đuro Đaković Montaža TIG / REL welders, the supplied plan sets out this four-part assessment. Final instructions and supervision come from the testing team.</p>
          </div>
          <ol className={styles.welderSteps}>
            {welderStages.map((stage, index) => <li key={stage.title} data-reveal><span>{String(index + 1).padStart(2, "0")}</span><h3>{stage.title}</h3><p>{stage.copy}</p></li>)}
          </ol>
          <p className={styles.sourceNote}>This outline applies to that employer and role. Other welding tests and the remaining role assessments should be confirmed with BEI Manpower.</p>
        </section>

        <section className={styles.finalCta} data-reveal aria-labelledby="fair-cta-title">
          <div><p className="eyebrow">Make your next move</p><h2 id="fair-cta-title">Bring your skills.<br />Build your future.</h2><p>Explore all 17 roles and apply with your CV.</p></div>
          <ActionLink href="/jobs" variant="light">Find your role</ActionLink>
          <BrandMark className={styles.ctaSpark} />
        </section>
        <p className={styles.pageSource}>Source: Job Fair Philippines organisation plan, dated 29 September 2026. The schedule and employer allocations reflect that plan. Confirm final participation, venue, accreditation status, testing arrangements, and requirements with BEI Manpower.</p>
      </div>
      <PageMotion />
    </div>
  );
}
