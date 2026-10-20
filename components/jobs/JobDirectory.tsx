"use client";
import { BrandMark } from "@/components/ui/Brand";

import { useDeferredValue, useEffect } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useSearchParams } from "next/navigation";
import { Search, X, ArrowDown, SlidersHorizontal } from "lucide-react";
import type { Job } from "@/lib/types";
import { JobCard } from "./JobCard";
import { getJobFairRole } from "@/data/job-fair";

export function JobDirectory({ jobs }: { jobs: Job[] }) {
  const params = useSearchParams();
  const query = params.get("q") || "";
  const keyword = useDeferredValue(query);
  useEffect(() => {
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(frame);
  }, [keyword, params]);
  const industry = params.get("industry") || "";
  const location = params.get("location") || "";
  const type = params.get("type") || "";
  const employer = params.get("employer") || "";
  const sort = params.get("sort") || "newest";
  const industries = [...new Set(jobs.map((j) => j.category))].sort();
  const locations = [...new Set(jobs.map((j) => j.location))].sort();
  const types = [...new Set(jobs.map((j) => j.employmentType).filter((type) => type !== "Terms to be confirmed"))].sort();
  const employers = [...new Set(jobs.flatMap((job) => getJobFairRole(job)?.employers.map((item) => item.name) || []))].sort();
  function update(key: string, value: string) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    window.history.replaceState(
      null,
      "",
      `/jobs${next.size ? "?" + next.toString() : ""}#job-results`,
    );
  }
  function clear() {
    window.history.replaceState(null, "", "/jobs#job-results");
  }
  const result = jobs
    .filter(
      (j) =>
        (!industry || j.category === industry) &&
        (!location || j.location === location) &&
        (!type || j.employmentType === type) &&
        (!employer || getJobFairRole(j)?.employers.some((item) => item.name === employer)) &&
        `${j.title} ${j.category} ${j.location} ${j.summary} ${j.requirements.join(" ")} ${getJobFairRole(j)?.employers.map((item) => item.name).join(" ") || ""}`
          .toLowerCase()
          .includes(keyword.toLowerCase().trim()),
    )
    .sort((a, b) =>
      sort === "az"
        ? a.title.localeCompare(b.title)
        : Date.parse(b.postedAt) - Date.parse(a.postedAt),
    );
  const availableSlots = result.reduce((total, job) => total + (employer ? getJobFairRole(job)?.employers.find((item) => item.name === employer)?.workers || 0 : job.openings || 0), 0);
  const hasFilter = !!(
    query ||
    industry ||
    location ||
    type ||
    employer ||
    sort !== "newest"
  );
  return (
    <section className="container directory-section" id="job-results">
      <h2 className="sr-only">Browse opportunities</h2>
      <div className="directory-search">
        <Search size={25} />
        <label className="sr-only" htmlFor="job-keyword">
          Search opportunities
        </label>
        <input
          id="job-keyword"
          type="search"
          value={query}
          onChange={(e) => {
            update("q", e.target.value);
          }}
          placeholder="What’s your next role? Search jobs, skills, or locations…"
        />
        <span className="search-hint">
          Find your fit <ArrowDown size={16} />
        </span>
      </div>
      <div className="filter-bar">
        <span className="filter-label">
          <SlidersHorizontal size={16} /> Refine your search
        </span>
        <div className={`filter-fields${employers.length ? " filter-fields-four" : ""}`}>
          <label>
            <span className="sr-only">Industry</span>
            <select
              aria-label="Industry"
              value={industry}
              onChange={(e) => update("industry", e.target.value)}
            >
              <option value="">All industries</option>
              {industries.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Location</span>
            <select
              aria-label="Location"
              value={location}
              onChange={(e) => update("location", e.target.value)}
            >
              <option value="">All locations</option>
              {locations.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          {types.length > 0 && <label>
            <span className="sr-only">Employment type</span>
            <select
              aria-label="Employment type"
              value={type}
              onChange={(e) => update("type", e.target.value)}
            >
              <option value="">Employment type</option>
              {types.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>}
          {employers.length > 0 && (
            <label>
              <span className="sr-only">Employer</span>
              <select aria-label="Employer" value={employer} onChange={(event) => update("employer", event.target.value)}>
                <option value="">All employers</option>
                {employers.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
          )}
        </div>
      </div>
      <div className="results-bar">
        <p aria-live="polite">
          <strong>{String(result.length).padStart(2, "0")}</strong>{" "}
          {result.length === 1 ? "opportunity" : "opportunities"}{" "}
          <span className="muted">
            / {jobs.length} published{" "}
            {jobs.every((j) => j.isExample) ? "examples" : "roles"}
            {result.some((j) => typeof j.openings === "number") && (
              <> · {availableSlots} available {availableSlots === 1 ? "slot" : "slots"}
              </>
            )}
          </span>
        </p>
        <div>
          {hasFilter && (
            <button onClick={clear} className="clear-filters">
              Clear all <X size={15} />
            </button>
          )}
          <label className="sort-field">
            <span className="sr-only">Sort jobs</span>
            <select
              aria-label="Sort jobs"
              value={sort}
              onChange={(e) => update("sort", e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="az">Title: A to Z</option>
            </select>
          </label>
        </div>
      </div>
      {(industry || location || type || employer) && (
        <div className="active-filters">
          {[
            ["industry", industry],
            ["location", location],
            ["type", type],
            ["employer", employer],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <button key={k} onClick={() => update(k, "")}>
                {v}
                <X size={13} />
                <span className="sr-only">Remove {k} filter</span>
              </button>
            ))}
        </div>
      )}
      <div className="job-results">
        {result.map((job, i) => (
          <JobCard key={job.id} job={job} index={i} employer={employer} />
        ))}
      </div>
      {!result.length && (
        <div className="empty-jobs">
          <BrandMark className="brand-spark" />
          <h2>A different direction?</h2>
          <p>
            No opportunities match these filters. Try another keyword or broaden
            your search.
          </p>
          <button className="button button-primary" onClick={clear}>
            Show all opportunities <ArrowDown size={17} />
          </button>
        </div>
      )}
      <div className="directory-end">
        <span>You’ve reached the end of these opportunities.</span>
        <a href="#main-content" className="text-link">
          Back to top ↑
        </a>
      </div>
    </section>
  );
}
