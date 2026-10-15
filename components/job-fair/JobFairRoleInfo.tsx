import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import type { Job } from "@/lib/types";
import { fairDocumentTiming, getJobFairRole, jobFair } from "@/data/job-fair";
import styles from "./JobFairRoleInfo.module.css";

export function JobFairRoleInfo({ job, compact = false }: { job: Job; compact?: boolean }) {
  const role = getJobFairRole(job);
  if (!role) return null;
  return (
    <section className={`${styles.panel} ${compact ? styles.compact : ""}`} aria-label="Job fair information for this role">
      <span className="eyebrow">Humble Hunters × BEI Manpower</span>
      <h3>Job Fair Philippines 2026</h3>
      <p className={styles.date}><CalendarDays size={17} /> Planned testing · {jobFair.testingDateLabel}</p>
      <p className={styles.label}>Employer allocations in the event plan</p>
      <ul className={styles.employers}>
        {role.employers.map((employer) => (
          <li key={employer.name}><span>{employer.name}</span><strong>{employer.workers} {employer.workers === 1 ? "worker" : "workers"}</strong></li>
        ))}
      </ul>
      <p className={styles.credential}><strong>NC2 guidance</strong>{role.nc2}</p>
      {role.focus && <p className={styles.note}>{role.focus}</p>}
      {!compact && (
        <>
          <h4>Testing for this role</h4>
          <ul className={styles.testing}>{role.testing.map((item) => <li key={item}>{item}</li>)}</ul>
          <p className={styles.note}>{fairDocumentTiming} Upload your CV and optionally attach the supporting documents you have available.</p>
          <p className={styles.source}>From the 29 September 2026 event plan. Venue and final arrangements are to be confirmed with BEI Manpower.</p>
        </>
      )}
      <Link href="/job-fair#documents" className={styles.link}>Event & document guide <ArrowUpRight size={16} /></Link>
    </section>
  );
}
