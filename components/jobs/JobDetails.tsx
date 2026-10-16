import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  MapPin,
  Plus,
} from "lucide-react";
import type { Job } from "@/lib/types";
import { MobileApply } from "./MobileApply";
import { JobSalary } from "./JobSalary";
import { EmploymentBenefits, NoPlacementFee } from "./EmploymentBenefits";
import styles from "./JobDetails.module.css";
import { getJobFairRole } from "@/data/job-fair";
import { JobFairRoleInfo } from "@/components/job-fair/JobFairRoleInfo";

const roleQuestions: Record<string, { question: string; answer: string }> = {
  "warehouse-worker": {
    question: "Do I need a forklift licence?",
    answer:
      "This example role does not require you to operate a forklift. Any live vacancy involving powered handling equipment should state its licence and training requirements clearly.",
  },
  "bus-driver": {
    question: "Which driving licence do I need?",
    answer:
      "The employer must confirm the licence category for the vehicle and service. Include your current professional driving licence category and relevant vehicle experience when applying; do not upload identity documents at this initial stage.",
  },
  "auto-mechanic": {
    question: "Which vehicles would I work on?",
    answer:
      "This example describes passenger-vehicle maintenance. The employer must confirm the vehicle makes, diagnostic systems, and specific workshop duties for a live vacancy.",
  },
  carpenter: {
    question: "Is this workshop or site carpentry?",
    answer:
      "The example covers workshop preparation and possible installation. The employer must confirm whether the live role involves joinery, fit-out, formwork, or a different carpentry specialism.",
  },
  "construction-worker": {
    question: "How long is the project?",
    answer:
      "A contract duration has not been provided for this example. A live project-based position should identify the worksite, expected duration, assigned tasks, and applicable terms before you accept.",
  },
  "production-line-worker": {
    question: "What will the production line make?",
    answer:
      "This example describes textile manufacturing. The actual product, machinery, training, and shift schedule must be confirmed in the live vacancy.",
  },
  "hotel-housekeeper": {
    question: "Is previous hotel experience necessary?",
    answer:
      "Professional cleaning or hotel experience can be useful, but this example does not state a mandatory minimum. A live employer should confirm the training offered and expected experience.",
  },
  butcher: {
    question: "Which food-safety documents are required?",
    answer:
      "Required training or food-handling credentials depend on the actual duties and site. Describe your relevant credentials in the application; the recruitment team should confirm any documentation needed at a later stage.",
  },
  electrician: {
    question: "What electrical certification is required?",
    answer:
      "The required qualification depends on the actual electrical system and authorised scope of work. The employer must state the relevant credential, supervision, and safety requirements for a live vacancy.",
  },
  welder: {
    question: "Which welding process would I use?",
    answer:
      "The welding process has not been specified for this example. Include the processes, materials, and positions you have experience with; a live employer should confirm the required procedure and qualification standard.",
  },
  "bakery-worker": {
    question: "Are early shifts required?",
    answer:
      "No shift pattern has been confirmed for this example. A live bakery vacancy should state the working hours and any early-morning or rotating-shift requirements.",
  },
  "truck-mechanic": {
    question: "What type of truck fleet is involved?",
    answer:
      "The fleet has not been specified for this example. Include the commercial vehicle types and systems you have serviced, and confirm the fleet and duties with the employer for a live role.",
  },
};

function NumberedSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section} data-reveal>
      <div className={styles.sectionHeading}>
        <span>{number}</span>
        <h2>{title}</h2>
      </div>
      <div className={styles.sectionContent}>{children}</div>
    </section>
  );
}

function ApplyPanel({ job }: { job: Job }) {
  return (
    <aside className={styles.sidebar} aria-label="Application summary">
      <div className={styles.applyPanel}>
        <span className={`eyebrow ${styles.panelEyebrow}`}>
          JOBS IN CROATIA
        </span>
        <h2>{job.title}</h2>
        <NoPlacementFee compact />
        <dl>
          <div>
            <dt>
              <MapPin size={15} />
              Location
            </dt>
            <dd>{job.location}</dd>
          </div>
          <div>
            <dt>Experience</dt>
            <dd>{job.experience}</dd>
          </div>
          <div>
            <dt>Compensation</dt>
            <dd>{job.salary ? <JobSalary job={job} compact /> : "To be confirmed"}</dd>
          </div>
          {typeof job.openings === "number" && (
            <div>
              <dt>{job.salaryStatus === "proposed-net" ? "Available positions" : "Openings"}</dt>
              <dd>{job.openings}</dd>
            </div>
          )}
        </dl>
        <Link
          href={`/jobs/${job.slug}/apply`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Apply now for ${job.title} (opens in a new tab)`}
          className={`button button-primary ${styles.panelButton}`}
        >
          APPLY NOW <ArrowUpRight size={19} />
        </Link>
        <p>A few simple steps. Have your CV ready.</p>
        {job.isExample && (
          <div className={styles.panelExample}>
            Example vacancy · Applications are for demonstration purposes.
          </div>
        )}
      </div>
      <Link href="/jobs" className={styles.backLink}>
        Explore all opportunities <ArrowRight size={16} />
      </Link>
    </aside>
  );
}

export function JobDetails({
  job,
  relatedJobs,
}: {
  job: Job;
  relatedJobs: Job[];
}) {
  const fairRole = getJobFairRole(job);
  const roleQuestion = job.salaryStatus === "proposed-net" ? {
    question: "What should I check before accepting a role?",
    answer: "Confirm the employer, work location, deductions, working hours, and written terms before accepting any offer.",
  } : roleQuestions[job.slug] || {
    question: "What should I include in my application?",
    answer:
      "Describe experience and skills relevant to this position and attach your current CV. Use the responsibilities and requirements above as a guide.",
  };
  const postedDate = new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(job.postedAt));
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href="/jobs">Opportunities</Link>
            <span>/</span>
            <span aria-current="page">{job.title}</span>
          </nav>
          <div className={styles.heroGrid}>
            <div className={styles.heroText}>
              <div className={styles.positionLabel} data-enter>
                <span />
                {job.isExample ? "EXAMPLE VACANCY" : "HIRING IN THE PHILIPPINES"}
              </div>
              <p className={styles.category} data-enter>
                {job.category}
              </p>
              <h1 data-enter>
                {job.title}
                <span className={styles.titleDot}>.</span>
              </h1>
              <NoPlacementFee />
              <p className={styles.summary} data-enter>
                {job.summary}
              </p>
              {fairRole && (
                <p className={styles.applicantNote} data-enter>
                  <strong>Filipino workers wanted.</strong>
                  This role is for Filipino applicants with the relevant skills,
                  experience and qualifications listed below.
                </p>
              )}
              <div className={styles.metadata} data-enter>
                <span>
                  <MapPin size={16} />
                  {job.location}
                </span>
              </div>
              {typeof job.openings === "number" && (
                <p className={styles.workerCount} data-enter>
                  <strong>{job.openings}</strong> positions available
                </p>
              )}
              <div className={styles.salary} data-enter><JobSalary job={job} /></div>
              <div className={styles.heroActions} data-enter>
                <Link
                  href={`/jobs/${job.slug}/apply`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Apply now for ${job.title} (opens in a new tab)`}
                  className="button button-primary"
                >
                  APPLY NOW <ArrowUpRight size={19} />
                </Link>
                <a href="#position-overview" className={styles.readLink}>
                  GET TO KNOW THE ROLE <ArrowDown size={16} />
                </a>
              </div>
            </div>
            <div className={styles.heroImage} data-enter>
              <Image
                src={job.image}
                alt={job.imageAlt}
                fill
                loading="eager"
                fetchPriority="high"
                sizes="(max-width: 800px) 100vw, 50vw"
                style={{ objectPosition: job.imagePosition || "center" }}
              />
              <div className={styles.imageCaption}>
                {job.salaryStatus === "proposed-net" ? "AI-GENERATED ROLE ILLUSTRATION" : "THE PEOPLE BEHIND PROGRESS."} <span>↗</span>
              </div>
            </div>
          </div>
          <div className={styles.heroFoot}>
            <span>JOBS IN CROATIA / {job.category.toUpperCase()}</span>
            <span>
              <CalendarDays size={13} />{" "}
              {job.salaryStatus === "proposed-net" ? "Listed" : job.isExample ? "Example date" : "Posted"} · {postedDate}
            </span>
          </div>
        </div>
      </section>

      <div className={`container ${styles.contentGrid}`}>
        <article id="position-overview" className={styles.article}>
          {job.isExample && (
            <div className={styles.exampleNotice}>
              <span>PLEASE NOTE</span>
              <p>
                This is an example vacancy for exploring the application
                experience. It is not a confirmed opening with an employer.
                Photographs illustrate the profession.
              </p>
            </div>
          )}
          <NumberedSection number="01" title="Position overview">
            <p>{job.description}</p>
            <JobFairRoleInfo job={job} />
          </NumberedSection>
          <NumberedSection number="02" title="Key responsibilities">
            <ul className={styles.list}>
              {job.responsibilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </NumberedSection>
          <NumberedSection number="03" title="Qualifications & requirements">
            <ul className={styles.list}>
              {job.requirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
              {fairRole?.drivingLicenseIsPlus && <li>A driver’s license is a plus (optional).</li>}
            </ul>
            <div className={styles.smallNote}>
              Relevant experience: {job.experience}.
            </div>
          </NumberedSection>
          <NumberedSection number="04" title="Compensation & employment">
            <dl className={styles.employment}>
              <div>
                <dt>Salary range</dt>
                <dd>{job.salary ? <JobSalary job={job} compact /> : "No verified salary has been provided."}</dd>
              </div>
              {typeof job.openings === "number" && (
                <div>
                  <dt>Available positions</dt>
                  <dd>{job.openings}</dd>
                </div>
              )}
            </dl>
            {!job.salary && (
              <p className={styles.smallNote}>
                Confirm pay, currency, gross or net basis, payment frequency,
                working hours, and the written employment terms before accepting
                a live offer.
              </p>
            )}
          </NumberedSection>
          <NumberedSection number="05" title="Benefits & support">
            <EmploymentBenefits benefits={job.benefits} />
          </NumberedSection>
          <NumberedSection number="06" title="Recruitment process">
            <p>
              {job.isExample
                ? "For a genuine vacancy, the process would typically follow these stages. This example application demonstrates submission and record creation only."
                : "The stages below describe a typical process. The employer may adjust the sequence or request a role-specific assessment."}
            </p>
            <ol className={styles.process}>
              <li>
                <span>01</span>
                <div>
                  <h3>Submit your application</h3>
                  <p>
                    Share your background, relevant skills, and CV using the
                    online form.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Application review</h3>
                  <p>
                    The recruitment team reviews your information against the role requirements.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Interview & assessment</h3>
                  <p>
                    If shortlisted, discuss your experience and complete any role-specific assessment. The team will confirm your interview and assessment arrangements.
                  </p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <h3>Decision & next steps</h3>
                  <p>
                    The team communicates the outcome. Review confirmed
                    employment terms before accepting an offer.
                  </p>
                </div>
              </li>
            </ol>
          </NumberedSection>
          <NumberedSection number="07" title="A little more clarity">
            <div className={styles.faq}>
              {[
                roleQuestion,
                {
                  question: "What documents should I prepare?",
                  answer:
                    "Prepare your current CV as a PDF, DOC, or DOCX file, up to 5 MB. Include relevant work experience and training. Do not upload passports, national IDs, medical records, or other sensitive identity documents at this initial stage.",
                },
                {
                  question: "How do I know my application was received?",
                  answer:
                    "After a successful submission, you will see a confirmation with your position and unique application reference. Save the reference for your records. A confirmation appears only after your application has been saved.",
                },
                {
                  question: "Can I apply for another position?",
                  answer:
                    "Yes. Explore the job directory and submit a separate application for another relevant position. Each application is associated with its selected role.",
                },
              ].map((item) => (
                <details key={item.question}>
                  <summary>
                    {item.question}
                    <Plus size={18} aria-hidden="true" />
                  </summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </NumberedSection>
        </article>
        <ApplyPanel job={job} />
      </div>

      {relatedJobs.length > 0 && (
        <section className={styles.related}>
          <div className="container">
            <div className={styles.relatedHeading} data-reveal>
              <div>
                <span className="eyebrow">08 / KEEP EXPLORING</span>
                <h2>
                  More paths.
                  <br />
                  More possibilities<span>.</span>
                </h2>
              </div>
              <Link href="/jobs" className={styles.relatedAll}>
                ALL OPPORTUNITIES <ArrowUpRight size={19} />
              </Link>
            </div>
            <div className={styles.relatedGrid}>
              {relatedJobs.map((item, index) => (
                <article
                  key={item.id}
                  className={styles.relatedJob}
                  data-reveal
                >
                  <Link
                    href={`/jobs/${item.slug}`}
                    className={styles.relatedImage}
                  >
                    <Image
                      src={item.image}
                      alt={item.imageAlt}
                      fill
                      sizes="(max-width: 650px) 100vw, (max-width: 1000px) 50vw, 33vw"
                      style={{ objectPosition: item.imagePosition || "center" }}
                    />
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <ArrowUpRight size={23} className={styles.imageArrow} />
                  </Link>
                  <p className={styles.relatedCategory}>
                    {item.category}
                    {item.isExample && <span>EXAMPLE</span>}
                  </p>
                  <h3>
                    <Link href={`/jobs/${item.slug}`}>{item.title}</Link>
                  </h3>
                  <p className={styles.relatedLocation}>{item.location}</p>
                  {typeof item.openings === "number" && (
                    <p className={styles.relatedLocation}>{item.openings} workers{item.salaryStatus === "proposed-net" ? " proposed" : " sought"}</p>
                  )}
                  <JobSalary job={item} compact />
                  <div className={styles.relatedActions}>
                    <Link href={`/jobs/${item.slug}`}>
                      VIEW DETAILS <ArrowRight size={15} />
                    </Link>
                    <Link
                      href={`/jobs/${item.slug}/apply`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Apply now for ${item.title} (opens in a new tab)`}
                    >
                      APPLY NOW <ArrowUpRight size={15} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
      <MobileApply job={job} />
    </div>
  );
}
