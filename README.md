# Jobs in Croatia — Recruitment website

A complete Next.js App Router recruitment platform with locally hosted THICCCBOI typography, licensed workplace photography, GSAP scroll reveals, an editorial homepage, searchable jobs, role details, four-step applications, and an authenticated recruitment workspace.

Source repository: [preymium5-ctrl/Job-Fair](https://github.com/preymium5-ctrl/Job-Fair). For Vercel import settings, required production services, and the upload/queue work needed before accepting live applications, see [Deploying to Vercel](docs/VERCEL.md).

## Run locally

Node.js 20.9+ is required. Dependencies are installed and locked in `package-lock.json`.

```powershell
npm install
Copy-Item .env.example .env.local
npm run admin:setup -- --email your-email@example.com
npm run dev
```

Open the URL matching `APP_ORIGIN` in `.env.local` (the prepared installation uses `http://127.0.0.1:3000`). The origin must include the exact scheme, hostname and port used in the browser. The administrator setup prompts for a password without printing it; there is no default staff account. Provision staff **before starting the server**, since the local embedded database supports one Node.js process at a time. The public site and example application flow also work without provisioning an administrator in local mode.

For a production build running locally, retain `CHAPTER_LOCAL_MODE=true`:

```powershell
npm run build
npm start
```

The `.data` directory persists local jobs, applications, private resumes, staff credentials, sessions, rate limits, and audit records. It is excluded from Git. The proposed catalogue seeds once per version, so staff edits survive restarts. Use fictitious applicant details when testing this preview.

## Included experience

- Nine homepage sections with distinct editorial layouts, local photography, accessible FAQ accordions, and reduced-motion support.
- `/jobs`: keyword, industry, location and employment filters; newest/alphabetical sorting; URL synchronization; empty states; direct Apply actions.
- `/jobs/[slug]`: unique role photography, responsibilities, requirements, employment details, recruitment stages, role FAQs, sticky Apply controls and related opportunities.
- `/jobs/[slug]/apply`: inline validation, review/edit, private resume upload, progress, safe retries, server validation and a reference only after durable persistence.
- Applications collect employer preference and optional role-specific NC2 details, with a required CV and optional diploma, NC2, NBI/apostille, Form 18a and other supporting uploads. Page 5 lists a driver’s license as a plus for all 17 job-fair roles, so these roles also collect optional license type/country details and a private license copy. Applicants are not asked for document-readiness statuses. Supporting files accept PDF, DOC, DOCX, JPG and PNG up to 3 MiB each; all files together are limited to 15 MiB. A transactional delivery queue sends each new record and private file copies to the configured Google Sheet/Drive receiver, with signed requests, duplicate protection and automatic retries. Live delivery requires the one-time [Google setup](docs/GOOGLE_SHEETS_SETUP.md); the chat connector's credentials are not reused by the website.
- `/admin`: staff sign-in, job creation/editing, photo uploads, publishing/closing, applicant search/filter/detail, private resume downloads and application status changes.
- `/job-fair`: applicant guide for the Humble Hunters × BEI Manpower November 2026 event, six employer allocations, interview/testing dates, NC2 guidance and later work permit documents. Home and jobs pages link to the guide; employer filtering uses each employer's allocated worker counts.
- About, application help, privacy and terms routes; page metadata; canonical links; robots/sitemap behavior. Example vacancies are clearly labeled and omitted from JobPosting markup and the job sitemap.

The catalogue contains 17 user-supplied proposed roles for 248 workers. Salary ranges are in EUR per month, proposed NET salary, not confirmed employer offers. Employer allocations, testing plans and NC2 guidance follow the dated event plan; work locations, contract terms and benefits remain unconfirmed. Each role has a separately generated illustrative image in `public/images/jobs/proposed/`. Prior example records are closed and their application links retained by a versioned, transactional catalogue update; staff-created jobs are preserved. Proposed roles are labeled throughout listing, details, and application pages, and omitted from search-engine job markup and the job sitemap.

Employer allocations and NC2/testing guidance are enriched from the user-supplied event plan dated 29 September 2026. This PDF provides no salary, worksite, public contact or exact venue information. See [content provenance](docs/JOB_FAIR_SOURCE.md) for the page-to-content mapping and excluded internal operational material.

## Verify

```powershell
npm run lint
npm run typecheck
npm test
npx tsx scripts/smoke-routes.ts http://127.0.0.1:3000
npm run build
```

The automated suite checks durable persistence, authentication and session integrity, same-origin protection, upload format validation, private downloads, audited edits, idempotent applications, job closure, image sanitization and configuration safeguards. The read-only route smoke script checks all public/detail/application routes and missing-role responses. Browser QA covers desktop/mobile layout, filtering, inline errors and application submission using fictitious data.

## Production configuration

Use a Node.js deployment with PostgreSQL and a private S3-compatible bucket. Disable `CHAPTER_LOCAL_MODE`, set an HTTPS `APP_ORIGIN`, a random `SESSION_SECRET`, `DATABASE_URL`, the S3 settings, and provision an authorized staff account. Full configuration and operational limits are documented in [docs/BACKEND.md](docs/BACKEND.md). External PostgreSQL/S3 connections require operator credentials and were not tested here. Local persistence is tested.

Before real recruitment, supply verified vacancies, the organization’s branding/contact information, final privacy/terms and retention policy. Configure backups and any required malware scanning. Format validation is implemented; a malware scanning service and automated email/ATS delivery are not configured. Staff use the protected portal to review applications.

## Project layout

`app/` contains routes; `components/` is organized by layout/home/jobs/applications/admin/animations/ui; `lib/` holds typed persistence, security, validation and storage; `data/` provides proposed role records. Photo credits, generation prompts, source links and licenses are recorded in [ASSETS.md](ASSETS.md); the local THICCCBOI font includes its SIL Open Font License.

The reference websites informed the visual direction and recruitment structure; their branding, assets and code were not copied.
