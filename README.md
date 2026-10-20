# Jobs in Croatia — Recruitment website

A complete Next.js App Router recruitment platform with locally hosted THICCCBOI typography, licensed workplace photography, GSAP scroll reveals, an editorial homepage, searchable jobs, role details, a single-page application form, and an authenticated recruitment workspace.

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
- `/jobs/[slug]/apply`: a centered, single-page form following the supplied reference's personal details, work choices, document uploads, notices and consent order. Inline validation, private uploads, progress, safe retries and server validation produce a reference only after durable persistence.
- Applications collect passport-style personal details, active WhatsApp and optional Telegram contacts, current work country, destination, primary and secondary job choices, English proficiency and consent. Nationality is no longer collected. CV, passport and residence ID are required; driver's license copies are also required for driver applicants. Other supporting uploads are optional, and Form 18a is identified for Croatia applicants. Upload cards show file requirements, selection, replacement, removal and a live checklist. CVs accept PDF, DOC or DOCX; other documents also accept JPG/PNG. Each file is limited to 3 MiB and all files together to 4 MiB. Version-3 Google delivery sends the complete structured profile and all supplied documents to the schema-5 receiver, which writes 54 tracker columns and private Drive links while preserving the original column positions and legacy Jobstreet Croatia requests. The website retains private staff downloads. The receiver must be migrated and deployed before expanded exports can succeed. The form retains **No placement fee**. See [Google setup](docs/GOOGLE_SHEETS_SETUP.md) for delivery and compatibility details.
- `/admin`: staff sign-in, job creation/editing, photo uploads, publishing/closing, applicant search/filter/detail, private resume downloads and application status changes.
- Job-fair source data supports six employer allocations, interview/testing dates, NC2 guidance and later work permit documents. Employer filtering uses each employer's allocated worker counts; `/job-fair` redirects to `/jobs`.
- Page titles, canonical links, social previews and crawlable job-fair guidance target Philippines job fair 2026 and work abroad in Croatia. Public role pages appear in the production sitemap; local previews, forms and example vacancies stay out of search. See [docs/SEO.md](docs/SEO.md) for Google Search Console verification and domain setup.

The catalogue contains 17 grouped roles with 11,100 displayed slots from the owner's 16 October update in `data/hiring-allocations.ts`. The PDF's 23 employer/position rows represent 17 distinct role titles and a historical allocation of 248 workers. Each distinct role has one listing and application route; shared titles group their employer allocations. Salary ranges are proposed NET EUR per month, not confirmed employer offers. Current recruitment content includes the owner's Croatia location, benefits and experience requirements. The versioned rollback retains job IDs, applicant history and staff-created records while retiring the six employer-specific duplicates. Published role guides appear in the sitemap and use WebPage markup; JobPosting rich-result markup remains omitted.

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
