# Job Fair Philippines 2026 — content source

Source: user-supplied `F:/Whatsapp Download/Job_Fair_Philippines_2026_EN.pdf`, seven pages, dated 29 September 2026. Integrated on 15 October 2026.

The site owner updated the online interview dates to **26 October – 14 November 2026** and the planned testing dates to **16–20 November 2026** on 15 October 2026. The website uses this updated schedule; the original PDF dates below are retained as source history.

- Pages 1–2: event name, Humble Hunters × BEI Manpower, online interviews 5–30 October 2026, planned testing 9–13 November 2026 in the Philippines. The 7–14 November dates cover delegation travel, not applicant testing.
- Pages 3–4: six employer allocations totaling 248 workers across the existing 17 role categories. Counts are recorded in `data/job-fair.ts` and checked against `data/jobs.ts`. Accreditation statements are historical planning information, not current verification.
- Page 5: Đuro Đaković Montaža TIG / REL test outline, later work permit document checklist, NC2 mapping, and the explicit timing note that these documents need not be ready on testing day. The document places “driving licence is a plus” under **All positions**, so all 17 known job-fair roles display this optional advantage and collect optional license details and a private copy. Unrelated staff-created jobs do not collect these fields. Pipe fitter, sheet metal / tinsmith processor and robotic welding operator NC2 categories are not specified, so the website asks for confirmation rather than inferring a category.
- The document contains no salary ranges, actual worksite location, contract terms, benefits, public email/phone, or testing-centre address. The separately supplied proposed NET salary ranges remain unchanged. Missing venue and contact information is marked for confirmation.

The public website presents applicant-facing event, employer, testing and document information. Internal staff assignments, sourcing targets, budgets, travel plans, coordination instructions, and directions to market positions under other clients are not published or executed. The potential additional 40 positions and the 40 existing Vertiv interviewees are excluded from the 248 job-order total. The original internal PDF is not copied into `public/`.

`getJobFairRole()` matches both the known seed ID and slug. A versioned database enrichment updates only untouched original description/requirements fields, preserving custom edits, salaries, images, job status, application links and audit history.
