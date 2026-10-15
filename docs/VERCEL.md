# Deploying Jobs in Croatia to Vercel

The repository can be imported as a Next.js project. Public pages and the sitemap use the built-in fair catalog when no production database is configured. The current complete application flow runs locally or on a persistent Node.js server. A GitHub import alone does not connect the live application backend, private uploads, or Google Sheets.

## Import settings

1. In Vercel, choose **Add New → Project** and import `preymium5-ctrl/Job-Fair`.
2. Select the **Next.js** framework preset and repository root (`./`). Use `main` as the production branch.
3. Use `npm ci` for installation and `npm run build` for the build. Leave the output directory at the Next.js default. Choose a supported Node.js version satisfying Next.js's requirement of Node.js 20.9 or newer.
4. Add the production environment variables below before deploying. Use the eventual HTTPS production domain consistently for both origin variables. If the domain changes, update these values and redeploy.

Vercel's built-in Next.js support handles routing and static assets; this project needs no custom rewrite or static-export configuration. See [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs) and [environment variables](https://vercel.com/docs/environment-variables).

## Production services and environment variables

Provision an external PostgreSQL database and a private S3-compatible bucket. The local `.data` directory is not uploaded and cannot serve as persistent storage on Vercel. The deployment database user must be allowed to create the application tables and indexes; migrations run on the first database connection.

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
| `SEED_PROPOSED_JOBS` | `true` to populate the current 17 roles / 248 workers once per catalogue version |
| `INDEX_SITE` | `true` for the public production site; `false` explicitly pauses indexing. Local mode and Vercel previews always remain noindex. |
| `GOOGLE_SITE_VERIFICATION` | Optional Search Console HTML-tag content value; see [SEO.md](SEO.md) |
| `GOOGLE_SHEETS_WEBHOOK_URL` | Existing authorized Apps Script deployment URL ending in `/exec` |
| `GOOGLE_SHEETS_WEBHOOK_SECRET` | Existing matching receiver secret, kept server-only |

Keep `TRUST_PROXY=false` unless the deployment's proxy behavior has been verified against the backend's IP-header handling. Set `NEXT_PUBLIC_CONTACT_EMAIL` once a public recruitment contact is confirmed. Preview deployments need their own matching origin, database, bucket, and test receiver to avoid sending test applications to production.

The primary public origin is `https://www.jobsincroatiaa.com`; use it for both origin variables. `jobstreetcroatia.com` redirects to this domain. See [SEO.md](SEO.md) for canonical URLs, search visibility and Search Console setup.

The legacy `CHAPTER_` setting names are internal compatibility identifiers. The displayed website name is Jobs in Croatia.

Set secrets directly in Vercel's environment settings. The existing private `.env.local`, database, uploads, and generated Apps Script configuration are excluded from Git. The safe receiver template is in `integrations/google-sheets/`; the live receiver must retain its existing matching secret.

## Provision the staff account

From an authorized terminal with the **production** `DATABASE_URL` in its environment, run:

```powershell
npm run admin:setup -- --email your-email@example.com
```

The script prompts for a password without displaying it. Provisioning is a one-time administrative step, not a build command. Never commit the password or leave `ADMIN_SETUP_PASSWORD` configured on the website. Local staff accounts and application records are not automatically copied to PostgreSQL.

## Work required before live applications on Vercel

### File upload and download transport

[Vercel Functions limit request and response bodies to 4.5 MB](https://vercel.com/docs/functions/limitations#request-body-size). The current form sends all documents in one multipart request and permits a 5 MiB CV plus supporting documents, up to 15 MiB combined. Staff photo uploads allow 8 MiB. Those supported sizes exceed Vercel's limit, regardless of the application's own validation or function timeout configuration.

Before accepting live applications with these file limits, implement authenticated, short-lived direct-to-storage uploads and private signed downloads (or route file handling through a suitable external service). Preserve server validation, ownership checks, duplicate protection, and cleanup of abandoned files. Configuring an S3 bucket alone does not bypass the Vercel request limit. Increasing a Next.js body-size setting also does not change Vercel's platform limit.

### Google Sheets delivery retries

Each application attempts delivery during its request and persists a retry queue in the database. The existing `setInterval` worker is designed for a persistent Node.js server. Serverless instances may stop between requests, so it cannot guarantee automatic retries on Vercel.

Before launch, configure a persistent external worker to run `npm run applications:sync` on a schedule with the same production database, storage, and Sheets credentials, or implement an authenticated scheduled function that drains the existing queue. No public cron endpoint or Vercel cron job is currently included. The protected `/admin` workspace also exposes integration status and manual retries.

## Verify the deployment

After configuring the services and resolving the transport and retry requirements, verify the 17-role catalogue, staff login, a complete application with all supported attachment sizes, private staff downloads, Google Sheet delivery, and retry delivery after a temporary receiver outage. Test with fictitious applicant details and remove those records afterward. External production PostgreSQL/S3 and a Vercel deployment have not yet been validated by this repository's local test suite.
