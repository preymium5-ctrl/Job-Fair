import { ArrowUpRight, BusFront, House, ShieldCheck } from "lucide-react";
import { noPlacementFee, recruitmentBenefits, workingInCroatia } from "@/data/employment";
import type { Job } from "@/lib/types";
import styles from "./EmploymentBenefits.module.css";

export function NoPlacementFee({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.fee} ${compact ? styles.compact : ""}`}>
      <ShieldCheck aria-hidden="true" />
      <strong>{noPlacementFee}</strong>
    </div>
  );
}

export function RecruitmentSummary({ jobs }: { jobs?: Job[] }) {
  const includesBenefit = (benefit: string) => !jobs || (jobs.length > 0 && jobs.every((job) => job.benefits.some((item) => item.toLowerCase() === `${benefit.toLowerCase()}.`)));
  const transport = includesBenefit("Free transportation");
  const accommodation = includesBenefit("Free accommodation");
  return (
    <div className={`container ${styles.summaryWrap}`}>
      <div className={styles.summary}>
        <NoPlacementFee />
        {transport && <span><BusFront size={20} aria-hidden="true" /> Free transportation</span>}
        {accommodation && <span><House size={20} aria-hidden="true" /> Free accommodation</span>}
        {!transport && !accommodation && jobs && <span>{jobs.length} roles across {new Set(jobs.map((job) => job.location)).size} destinations</span>}
      </div>
    </div>
  );
}

export function WorkingInCroatia() {
  return (
    <div className={styles.future}>
      <h3>Build your future in Croatia</h3>
      <div className={styles.futureGrid}>
        {workingInCroatia.map(({ title, text, source }) => (
          <div className={styles.futureItem} key={title}>
            <h4>{title}</h4>
            <p>{text}</p>
            <a href={source} target="_blank" rel="noopener noreferrer">
              Official guidance <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmploymentBenefits({ benefits = recruitmentBenefits, location = "Croatia" }: { benefits?: string[]; location?: string }) {
  const items = [...new Set(benefits)].filter(
    (item) => item.trim().replace(/[.!]$/, "").toLowerCase() !== noPlacementFee.toLowerCase(),
  );
  return (
    <div className={styles.benefits}>
      <NoPlacementFee />
      {items.length > 0 && <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>}
      {location === "Croatia" && <WorkingInCroatia />}
    </div>
  );
}
