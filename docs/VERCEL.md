# Deploying Jobs in Croatia to Vercel

The repository can be imported as a Next.js project. Public pages and the sitemap use the built-in fair catalog when no production database is configured. On Vercel, the application form can save directly to the authorized Google Sheet and private Google Drive folder, or use the database/S3 backend. Importing GitHub source does not copy the private local environment; configure the selected storage mode before accepting submissions.

## Import settings

1. In Vercel, choose **Add New → Project** and import `preymium5-ctrl/Job-Fair`.
2. Select the **Next.js** framework preset and repository root (`./`). Use `main` as the production branch.
3. Use `npm ci` for installation and `npm run build` for the build. Leave the output directory at the Next.js default. Choose a supported Node.js version satisfying Next.js's requirement of Node.js 20.9 or newer.
4. Add the production environment variables below before deploying. Use the eventual HTTPS production domain consistently for both origin variables. If the domain changes, update these values and redeploy.

Vercel's built-in Next.js support handles routing and static assets; this project needs no custom rewrite or static-export configuration. See [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs) and [environment variables](https://vercel.com/docs/environment-variables).

## Google Sheets storage mode

Use this mode when recruitment staff work in the private Google tracker and Drive folder. It does not require PostgreSQL, S3 or a website staff account. Set these production environment variables, then redeploy:

| Variable | Production value |
| --- | --- |
| `APPLICATION_STORAGE` | `google-sheets` |
| `CHAPTER_LOCAL_MODE` | `false` |
| `APP_ORIGIN` | `https://www.jobsincroatiaa.com`, without a trailing slash; must exactly match the submitting browser's origin |
| `NEXT_PUBLIC_SITE_URL` | `https://www.jobsincroatiaa.com` |
| `GOOGLE_SHEETS_WEBHOOK_URL` | Existing authorized Apps Script deployment URL ending in `/exec` |
| `GOOGLE_SHEETS_WEBHOOK_SECRET` | Existing matching receiver secret, kept server-only |

`APP_ORIGIN` is also a security setting. A missing or mismatched value rejects submission with **Submit your application from this website.** before any Google delivery. Redirect alternate domains to the canonical origin. Do not disable the origin check to work around configuration errors.

The server validates the job, form fields and files, signs the complete request, and waits for Google to acknowledge the same application ID and reference. Only that acknowledgement produces a successful submission and confirmed reference. This mode accepts the current profile form, with a 4 MiB combined file limit; legacy API submissions without a profile are rejected. If the receiver is unavailable or rejects delivery, the applicant sees a retry message; the open form retains the selected files and retry key. Retrying the unchanged application reuses its identity so a lost acknowledgement does not create another row. There is no database-backed outbox or automatic background retry in this mode. Staff use the private Google Sheet and Drive; the website's `/admin` application workspace requires the database backend.

Deploy the schema-7 receiver before enabling this mode. Its compact tracker has 36 `A:AJ` columns: the 32 current form answer/file fields plus four tracking columns. **Where did you find us?** is appended at AJ; A:AI keeps its prior positions. For an existing 35- or 54-column sheet, deploy the compatible receiver first, then have the owner run `setupChapterSync` to create a hidden native backup and upgrade the active tab. The website's structured payload remains version 3. See [Google Sheets setup](GOOGLE_SHEETS_SETUP.md) for the private folder, migration order, source compatibility and verification procedure.

## Database storage mode

This remains the default when `APPLICATION_STORAGE` is unset; `APPLICATION_STORAGE=database` selects it explicitly. Provision an external PostgreSQL database and a private S3-compatible bucket. The local `.data` directory is not uploaded and cannot serve as persistent storage on Vercel. The deployment database user must be allowed to create the application tables and indexes; migrations run on the first database connection.

| Variable | Production value |
| --- | --- |
| `CHAPTER_LOCAL_MODE` | `false`; never enable local database/file fallback on Vercel |
| `DATABASE_URL` | PostgreSQL connection string with the provider's required TLS settings; prefer its serverless/pooling endpoint |
| `APP_ORIGIN` | Exact HTTPS production origin, without a trailing slash |
| `NEXT_PUBLIC_SITE_URL` | Same HTTPS production origin |
| `SESSION_SECRET` | A new random secret of at least 32 characters |
| `S3_BUCKET` | Private bucket name |
| `S3_REGION` | Bucket region |
| `S3_ACCESS_KEY_ID` | Server-only storage credential |
| `S3_SECRET_ACCESS_KEY` | Server-only storage credential |
| `S3_ENDPOINT` | Required for providers with a custom S3-compatible endpoint |
| `S3_FORCE_PATH_STYLE` | `true` only if required by the storage provider |
| `SEED_PROPOSED_JOBS` | `true` to populate and migrate the current 17 grouped roles / 11,100 displayed slots once per catalogue version; the PDF's 248 workers remain archived source figures |
| `INDEX_SITE` | `true` for the public production site; `false` explicitly pauses indexing. Local mode and Vercel previews always remain noindex. |
| `GOOGLE_SITE_VERIFICATION` | Optional Search Console HTML-tag content value; see [SEO.md](SEO.md) |
| `GOOGLE_SHEETS_WEBHOOK_URL` | Optional authorized Apps Script deployment URL ending in `/exec`, for queued Google exports |
| `GOOGLE_SHEETS_WEBHOOK_SECRET` | Matching receiver secret when Google exports are enabled, kept server-only |

Keep `TRUST_PROXY=false` unless the deployment's proxy behavior has been verified against the backend's IP-header handling. Set `NEXT_PUBLIC_CONTACT_EMAIL` once a public recruitment contact is confirmed. Preview deployments need their own matching origin and test receiver; database mode also needs isolated database and bucket settings to avoid sending test applications to production.

The primary public origin is `https://www.jobsincroatiaa.com`; use it for both origin variables. `jobstreetcroatia.com` redirects to this domain. See [SEO.md](SEO.md) for canonical URLs, search visibility and Search Console setup.

The legacy `CHAPTER_` setting names are internal compatibility identifiers. The displayed website name is Jobs in Croatia.

Set secrets directly in Vercel's environment settings. The existing private `.env.local`, database, uploads, and generated Apps Script configuration are excluded from Git. The safe receiver template is in `integrations/google-sheets/`; the live receiver must retain its existing matching secret.

## Provision the database-mode staff account

From an authorized terminal with the **production** `DATABASE_URL` in its environment, run:

```powershell
npm run admin:setup -- --email your-email@example.com
```

The script prompts for a password without displaying it. Provisioning is a one-time administrative step, not a build command. Never commit the password or leave `ADMIN_SETUP_PASSWORD` configured on the website. Local staff accounts and application records are not automatically copied to PostgreSQL.

## File-size limits and database-mode delivery workers

### File upload and download transport

[Vercel Functions limit request and response bodies to 4.5 MB](https://vercel.com/docs/functions/limitations#request-body-size). The current profile form sends all documents in one multipart request and caps combined files at 4 MiB, with a 3 MiB CV limit, leaving room for application fields and multipart overhead. Legacy API clients without a profile still accept a 5 MiB CV and 15 MiB combined files on a persistent Node.js deployment; those larger submissions exceed Vercel's limit. Staff photo uploads allow 8 MiB and also exceed it.

To support larger application files or the existing staff-photo limit on Vercel, implement authenticated, short-lived direct-to-storage uploads and private signed downloads (or route file handling through a suitable external service). Preserve server validation, ownership checks, duplicate protection, and cleanup of abandoned files. Configuring an S3 bucket alone does not bypass the Vercel request limit. Increasing a Next.js body-size setting also does not change Vercel's platform limit.

### Google Sheets delivery retries in database mode

The shared schema-7 Apps Script receiver accepts the current 36-column `A:AJ`, earlier 35-column `A:AI` and deprecated 54-column `A:BB` layouts during rollout. Preserve the existing deployment URL, matching secret and private folder. Update the existing deployment before the owner runs `setupChapterSync`; setup creates a hidden native backup and appends the referral column at AJ while preserving A:AI positions and existing rows. Earlier 54-column sheets first undergo the checked compaction, retaining their historical referral answers. Legacy Jobstreet Croatia requests and structured version-3 website payloads remain accepted. Verify the active headers, referral answer, all other form answers and supplied private document links with a synthetic submission; saving receiver source or reading health alone does not confirm migration or delivery. See [Google Sheets setup](GOOGLE_SHEETS_SETUP.md).

In database mode, each application attempts delivery during its request and persists a retry queue in the database. The existing `setInterval` worker is designed for a persistent Node.js server. Serverless instances may stop between requests, so it cannot guarantee automatic retries on Vercel.

For automatic database-mode retries on Vercel, configure a persistent external worker to run `npm run applications:sync` on a schedule with the same production database, storage, and Sheets credentials, or implement an authenticated scheduled function that drains the existing queue. No public cron endpoint or Vercel cron job is currently included. The protected `/admin` workspace also exposes integration status and manual retries. Google Sheets storage mode waits for delivery in the submission request and asks the applicant to retry failures, so this worker does not apply to that mode.

## Verify the deployment

After configuring the selected mode and redeploying, submit a complete application with fictitious details from the canonical production origin. Verify that the form displays a reference, the same reference appears once in **Applications**, every profile answer and supplied document link is present, and private document access works for authorized staff. Verify unchanged retries after a temporary receiver failure remain a single application, then remove the synthetic row and files. A successful public-page load or receiver health response does not prove that the production form is configured.

Verify the catalogue, application choices and sitemap. In database mode, keep `SEED_PROPOSED_JOBS=true` for versioned catalogue migrations and also verify staff login, private website downloads, application persistence and queued retry delivery. External production PostgreSQL/S3 are not validated by the local test suite.
