import type { Job } from "@/lib/types";

export function JobSalary({ job, compact = false }: { job: Job; compact?: boolean }) {
  if (!job.salary) return null;
  const proposed = job.salaryStatus === "proposed-net";
  return (
    <div className={`job-pay${compact ? " job-pay-compact" : ""}`}>
      <span className="job-pay-label">
        {proposed ? "Proposed NET salary" : "Compensation"}
      </span>
      <div className="job-pay-amount">
        <strong>{job.salary}</strong>
        {proposed && <span>EUR / month</span>}
      </div>
    </div>
  );
}

export function ProposedTermsNotice() {
  return (
    <div className="proposed-terms-notice">
      <span className="status-dot" />
      <div>
        <strong>Proposed roles & pay</strong>
      </div>
    </div>
  );
}
