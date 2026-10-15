# Recruitment backend

The Node.js route handlers use the same typed Drizzle schema with PostgreSQL in production and a durable PGlite database in local mode. Jobs, submitted applications, staff credentials, sessions, rate limits, and audit events are persisted. No external service is reported as connected until its supplied configuration has been tested.

## Local use

1. Copy `.env.example` to `.env.local` and retain `CHAPTER_LOCAL_MODE=true`.
2. Run `npm install` and `npm run admin:setup -- --email you@example.com`. The script prompts for a password of at least 12 characters without displaying it. There is no default account.
3. Run `npm run dev` and sign in at `/admin`.

PGlite stores data at `.data/db`; private files live under `.data/uploads`, outside `public`. Its local database is for **one Node.js process at a time**. Stop the web server before running `admin:setup` against the same local database. Local example jobs seed once; edits survive restarts. Do not remove `.data` to restart the site unless you intend to delete its data. `.data`, private environment files and generated QA assets are excluded from Git.

For a built local preview, explicitly set `CHAPTER_LOCAL_MODE=true` when running `npm run build` / `npm start`. This is a local preview setting and must be removed from a real deployment. `DATA_DIR` can select a persistent directory. Back up the full database and uploads together while the local process is stopped.

The setup script accepts `ADMIN_SETUP_EMAIL` and `ADMIN_SETUP_PASSWORD` environment variables for non-interactive provisioning. Remove the password variable afterward. To reset an existing staff member's password, run `npm run admin:setup -- --email you@example.com --reset`; it revokes all their sessions. Run this command only from an authorized server shell.

## Production configuration

Use a Node.js deployment with `DATABASE_URL`, `APP_ORIGIN`, `SESSION_SECRET`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`. Generate a random session secret, serve over HTTPS, provision a real administrator, and keep the S3-compatible bucket private. Compatible storage may also require `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE`. Database migrations initialize automatically on the first database connection under a PostgreSQL advisory lock; the deployment database role needs the privileges to create these tables and indexes.

Production rejects a missing database, a missing or short session secret, unconfigured private storage, or production applications without a provisioned administrator. Production starts with no jobs unless `SEED_PROPOSED_JOBS=true` is explicitly chosen to import the proposed catalogue (`SEED_EXAMPLE_JOBS=true` remains a legacy alias). The catalogue contains 17 user-supplied proposed roles for 248 workers; salary amounts are proposed NET EUR per month, not confirmed employer offers. The versioned update closes only the 12 original seed IDs and archives their slugs while preserving IDs, applications, audit history, and custom staff records. Any slug conflict with a custom record rolls back the transaction. The persistent version marker preserves later staff edits across restarts. Real vacancies and employment terms must be supplied and verified by the operator.

Set `TRUST_PROXY=true` only if the deployment's trusted reverse proxy overwrites `X-Forwarded-For` with the client's address. Otherwise rate limiting deliberately uses a shared request bucket. Limits persist in the database, including across multiple PostgreSQL instances of the application. Apply your production retention, access-review and backup policy to applications, resumes, audit events and expired sessions; this implementation does not impose an invented business retention period.

External PostgreSQL and S3 credentials were unavailable during implementation, so the external deployment path has not been integration-tested. Automated tests exercise local durable persistence and the API security behavior.

## API contracts

Public `POST /api/applications` accepts multipart fields `payload` (JSON matching `ApplicationInput`), `resume` (File), `website` (empty honeypot) and `idempotencyKey` (UUID). Optional supporting files use `document:diploma`, `document:nc2`, `document:nbi`, `document:form18a`, `document:other` and `document:driver-license`, one per category. The optional `driverLicenseDetails` field and driver-license upload are accepted only for the 17 PDF roles; both are optional and are available to authorized staff. Unknown or duplicate file fields are rejected. It returns `{ reference, jobTitle }` only after the application and all private files have been persisted. Repeating the same submission key and content returns the same reference; different content, including changed attachments, is rejected. Failed persistence triggers cleanup of all staged files.

Resumes are capped at 5 MB and restricted to PDF, DOC and DOCX. The server checks actual signatures; DOC requires Word compound-document markers, and DOCX requires coherent ZIP directories and Word XML, with expanded-size, encryption, macro and embedded-executable restrictions. Client MIME is not trusted for resumes. Resume downloads require staff authentication, are returned as attachments, have `no-store` headers, and create an audit event.

Staff API endpoints:

Supporting files accept PDF, DOC, DOCX, JPG and PNG up to 3 MiB each, with a combined 15 MiB limit including the CV. Images are decoded, rotated, stripped of metadata and re-encoded as JPEG. Document downloads use the same staff authentication, audit and private attachment headers as CV downloads. The Google queue sends file bytes in a signed version-2 payload and records private Drive links in columns W:AA of the Job Fair 2026 spreadsheet, with driver license details in AB and a private license-copy link in AC; CV-only submissions retain version-1 compatibility. Document-readiness statuses are no longer collected by the form or written into the spreadsheet. Immediate delivery is bounded to 20 seconds, while the background worker allows up to 120 seconds per request.

| Endpoint | Request | Result |
| --- | --- | --- |
| `/api/admin/session` | GET / POST `{email,password}` / DELETE | `{authenticated,email?}` |
| `/api/admin/jobs` | GET / POST full Job fields | `{jobs}` / `{job}` |
| `/api/admin/jobs/[id]` | PATCH job fields | `{job}` |
| `/api/admin/applications` | GET | `{applications}` |
| `/api/admin/applications/[id]` | PATCH `{status}` | `{application}` |
| `/api/admin/applications/[id]/resume` | GET | Private attachment |
| `/api/admin/applications/[id]/documents/[documentId]` | GET | Private supporting attachment |
| `/api/admin/images` | POST multipart `image` | `{url}` |

All mutations require a matching Origin header; production requires an explicit HTTPS `APP_ORIGIN`. Staff cookies are signed, HttpOnly, SameSite Strict, secure on production HTTPS, expire after eight hours, and are backed by revocable database sessions. Passwords use salted scrypt. Login and submission limits persist in the database. Job edits and application status changes are committed with audit records in the same transaction. Application references have a database uniqueness constraint. A job-row lock keeps an application insertion from racing a vacancy closure.

Job photos accept JPEG, PNG and WebP up to 8 MB / 36 million decoded pixels, at least 300 × 200. The server decodes, rotates and re-encodes them as JPEG, removes metadata, and caps the dimensions at 2000 × 2000. Only sanitized JPEG photo keys can be served through the public `/api/images/[key]` endpoint. Resume keys can never be served there.

API errors return `{error,fieldErrors?}` and never include database queries, applicant data, private file paths or credentials.

File signatures and archive restrictions are format validation, not malware detection. PDF and legacy DOC formats can contain active content that these checks do not fully parse. Resumes remain private and download as attachments; staff should inspect them using protected document tooling. An operator needing malware scanning should attach its approved scanner before publishing. This implementation includes no email delivery, external ATS integration or automatic retention deletion; the current workflow is the protected staff portal.

## Verification

`npm test` covers password/session integrity, validation, private storage, durable database restart, audited job edits, idempotent submission, rejection paths, authorized resume download, audited application status changes, logout revocation, persisted rate limits, and missing production configuration. Tests use isolated temporary data, not the developer's recruitment records.
