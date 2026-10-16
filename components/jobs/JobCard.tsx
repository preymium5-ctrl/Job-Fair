import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin } from "lucide-react";
import type { Job } from "@/lib/types";
import { JobSalary } from "./JobSalary";
import { NoPlacementFee } from "./EmploymentBenefits";
import { getJobFairRole } from "@/data/job-fair";
export function JobCard({
  job,
  index = 0,
  featured = false,
  employer,
}: {
  job: Job;
  index?: number;
  featured?: boolean;
  employer?: string;
}) {
  const fairRole = getJobFairRole(job);
  const allocation = employer ? fairRole?.employers.find((item) => item.name === employer) : undefined;
  const workers = allocation?.workers ?? job.openings;
  return (
    <article
      className={`job-card ${featured ? "job-card-featured" : "job-card-row"}`}
      data-reveal
    >
      <Link
        href={`/jobs/${job.slug}`}
        className="job-image"
        tabIndex={-1}
        aria-hidden="true"
      >
        <Image
          src={job.image}
          alt={job.imageAlt}
          fill
          loading={!featured && index === 0 ? "eager" : "lazy"}
          sizes={
            featured
              ? "(max-width: 700px) 100vw, 50vw"
              : "(max-width: 800px) 100vw, 45vw"
          }
          style={{ objectPosition: job.imagePosition || "center" }}
        />
        <span className="image-job-label">{job.category}</span>
        <span className="image-arrow">
          <ArrowUpRight size={24} />
        </span>
        {job.isExample && (
          <span className="example-image-label">Example vacancy</span>
        )}
        {job.salaryStatus === "proposed-net" && (
          <span className="example-image-label">AI-generated role illustration</span>
        )}
      </Link>
      <div className="job-info">
        <div className="job-topline">
          <span className="eyebrow">{job.category}</span>
          <span className="job-index">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <h3>
          <Link href={`/jobs/${job.slug}`}>{job.title}</Link>
        </h3>
        <NoPlacementFee compact />
        <div className="job-meta">
          <span>
            <MapPin size={14} />
            {job.location}
          </span>
          <span>{fairRole ? "For Filipino applicants" : job.employmentType}</span>
        </div>
        {fairRole && (
          <p className="job-fair-context">
            {allocation ? allocation.name : fairRole.employers.length === 1 ? fairRole.employers[0].name : `${fairRole.employers.length} employer options`}
          </p>
        )}
        {typeof workers === "number" && (
          <p className="job-workers">
            <strong>{workers}</strong>{" "}
            {workers === 1 ? "worker" : "workers"}
             available
          </p>
        )}
        <p className="job-summary">{job.summary}</p>
        {!featured && (
          <div className="job-extra">
            <span>{job.experience}</span>
            <span>
              {job.salaryStatus === "proposed-net" ? "Listed" : job.isExample ? "Example date" : "Posted"}{" "}
              <time dateTime={job.postedAt}>
                {new Intl.DateTimeFormat("en-PH", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: "Asia/Manila",
                }).format(new Date(job.postedAt))}
              </time>
            </span>
          </div>
        )}
        <JobSalary job={job} />
        <div className="job-actions">
          <Link href={`/jobs/${job.slug}`} className="text-link">
            View details <ArrowRight size={17} />
          </Link>
          <Link
            href={`/jobs/${job.slug}/apply`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Apply now for ${job.title} (opens in a new tab)`}
            className="button button-outline"
          >
            Apply now <ArrowUpRight size={17} />
          </Link>
        </div>
      </div>
    </article>
  );
}
