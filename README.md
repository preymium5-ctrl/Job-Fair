# Jobs in Croatia — Recruitment website

A complete Next.js App Router recruitment platform with locally hosted THICCCBOI typography, licensed workplace photography, GSAP scroll reveals, an editorial homepage, searchable jobs, role details, and a single-page application form.

Source repository: [preymium5-ctrl/Job-Fair](https://github.com/preymium5-ctrl/Job-Fair). For Vercel import settings and the Google Sheets or database storage configuration, see [Deploying to Vercel](docs/VERCEL.md).

The 21 October 2026 public catalogue contains 117 roles in 16 sectors: the
original 18 roles plus 99 specific positions from the primary/secondary
application choices. Operator-proposed salaries range from €850 to €2,000 per
month and slots from 250 to 1,200 per role. Destinations use the form's six
existing choices. The homepage sector directory links to filtered jobs, and
model imagery uses male workers. Terms are in `data/application-role-catalog.ts`;
image sources and prompts are recorded in `ASSETS.md`. Existing role IDs,
application history, archived allocations, and staff edits are preserved.

## Run locally

Node.js 20.9+ is required. Dependencies are installed and locked in `package-lock.json`.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open the URL matching `APP_ORIGIN` in `.env.local` (the prepared installation uses `http://127.0.0.1:3000`). The origin must include the exact scheme, hostname and port used in the browser. The public site and example application flow work without provisioning an administrator in local mode.

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
- `/apply`: a general application using the same form with no preselected job. Applicants select their role within the form, and submissions use the same validation, uploads and configured storage as job-specific applications.
- Applications collect passport-style personal details, active WhatsApp and optional Telegram contacts, current work country, destination, primary and secondary job choices, English proficiency, a required **Where did you find us?** choice and consent. Nationality is no longer collected. CV and passport are required; residence ID is optional; driver's license copies are also required for driver applicants. Other supporting uploads are optional, and Form 18a is identified for Croatia applicants. Upload cards show file requirements, selection, replacement, removal and a live checklist. CVs accept PDF, DOC or DOCX; other documents also accept JPG/PNG. Each file is limited to 5 MiB and all files together to 15 MiB. Large submissions use private 2 MiB staging parts to stay within the hosting request limit, then retain the existing server validation and Google delivery flow. Version-3 Google delivery sends structured profile answers and supplied documents to the schema-7 receiver. Its compact tracker contains 32 current form answer/file fields plus four tracking columns, with referral appended at AJ and existing A:AI positions preserved. Owner-run migration preserves existing rows and a hidden native backup; deploy the compatible receiver before upgrading an earlier 35- or 54-column layout. Legacy Jobstreet Croatia requests remain supported. Google Sheets storage mode confirms a reference only after the receiver acknowledges the saved application; staff use the private tracker and Drive. Database mode also retains private website downloads and a delivery retry queue. The form retains **No placement fee**. See [Google setup](docs/GOOGLE_SHEETS_SETUP.md) for delivery and compatibility details.
- The former `/admin` sign-in page and footer link have been removed. `/admin` and its subpaths redirect to the homepage. Staff review current applications in the private Google Sheet and Drive.
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

The Vercel application form can use `APPLICATION_STORAGE=google-sheets` with `CHAPTER_LOCAL_MODE=false`, the exact HTTPS `APP_ORIGIN`, `GOOGLE_SHEETS_WEBHOOK_URL` and its matching server-only `GOOGLE_SHEETS_WEBHOOK_SECRET`. Set `NEXT_PUBLIC_SITE_URL` to the same canonical origin. This mode saves applications and documents directly to the authorized Google Sheet and private Drive folder. A matching Google acknowledgement is required before the applicant sees a confirmed reference. If delivery fails, the form keeps the selected files and retry key while the page remains open so the applicant can retry safely; there is no background website queue in this mode.

The default database mode uses PostgreSQL, a private S3-compatible bucket, `SESSION_SECRET` and an authorized staff account. It retains the authenticated backend APIs and database-backed Google delivery queue. Those database/S3 services are optional for Google Sheets storage mode. The public staff workspace has been retired. Full Vercel configuration is in [docs/VERCEL.md](docs/VERCEL.md); the database backend is documented in [docs/BACKEND.md](docs/BACKEND.md).

Keep vacancies, organization/contact information, privacy/terms and retention policy current. Format validation is implemented; a malware scanning service and automated email/ATS delivery are not configured. Staff review Google Sheets mode submissions in Google; database mode submissions remain accessible through the authenticated backend APIs.

## Project layout

`app/` contains routes; `components/` is organized by layout/home/jobs/applications/admin/animations/ui; `lib/` holds typed persistence, security, validation and storage; `data/` provides proposed role records. Photo credits, generation prompts, source links and licenses are recorded in [ASSETS.md](ASSETS.md); the local THICCCBOI font includes its SIL Open Font License.

The reference websites informed the visual direction and recruitment structure; their branding, assets and code were not copied.
