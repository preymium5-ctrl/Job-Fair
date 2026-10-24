# Google Sheets application delivery

A signed server request sends the tracker details, structured profile answers, CV and all supplied supporting files to the Apps Script receiver, which saves private Drive files and writes their links in one row in the selected Google Sheet. There are two website storage modes:

- **Google Sheets mode** (`APPLICATION_STORAGE=google-sheets`): the server validates the current profile form and its uploads, then waits for a matching Google acknowledgement before confirming the reference. Legacy API submissions without a profile are rejected in this mode. The private Google Sheet and Drive folder are the recruiting workspace. No website database, S3 bucket or background outbox is used. If delivery fails, the applicant must retry from the open form, which retains its files and retry key. An unchanged retry reuses the application identity to recover a lost acknowledgement without duplicating the row.
- **Database mode** (default): the website stores the application and private uploads before attempting delivery, and retains a failed delivery in its database queue. A confirmed website reference therefore does not by itself mean Google has received the row. Staff can inspect and retry delivery through the authenticated backend APIs; the former `/admin` interface is retired. Vercel requires an external worker for reliable automatic retries.

In both modes, missing or incorrect `APP_ORIGIN` rejects the submission before delivery. Set it to the exact canonical browser origin and redeploy after changing production environment settings. Importing a repository does not copy its private `.env.local`.

The current application form has 32 answer/file fields, including the required **Where did you find us?** choice. The compact tracker contains those fields plus four tracking columns: application ID, reference, submission time and derived full name. The receiver's sheet schema is version 7; the website's structured request payload remains version 3. These are separate version numbers. Earlier non-profile website requests and the shared Jobstreet Croatia sender may still omit referral answers.

Target spreadsheet: [Job Fair 2026](https://docs.google.com/spreadsheets/d/1v9-lAvpJPUCxCqr03EkVwKKAfedEDtckHir4ro6cyeU/edit). The receiving tab is **Applications**. The receiver is pinned to this spreadsheet ID and checks the complete recognized header layout before writing. The compact layout is 36 columns, `A:AJ`. Its first 35 columns keep their prior positions; the referral answer is appended at AJ:

| Columns | Content |
| --- | --- |
| A:C | Application ID, reference, derived full name |
| D:F | Email, WhatsApp number, job position |
| G:I | Submission time (UTC), private CV document link, privacy consent |
| J:N | Private diploma, NC2, NBI/apostille, Form 18a and driver license document links |
| O:Q | First name, last name, gender |
| R:U | Street, city, province / state, postal code |
| V:Y | Date of birth, place of birth, father's full name, mother's full name |
| Z:AC | Destination country, current work country, additional experienced role, other job choice |
| AD:AF | English proficiency, Telegram number, terms accepted |
| AG:AI | Private passport, residence ID and employment-certificate links |
| AJ | Where did you find us? |

**NC2 document** contains the uploaded certificate link. There are no separate **NC2 certificate** or **Expected NC2** columns, no duplicate **CV file** column, and no columns for questions absent from the current form. Street, city, province and postal code remain separate; the duplicate combined address column is removed. Application source is retained in the application ID cell's note for receiver rate limiting rather than displayed as another column. That technical note also preserves legacy other-document links and driver-license details needed for duplicate verification; it is not another form question.

The application form displays **Macedonia**; historical `North Macedonia` answers remain accepted. Legacy version-1 and version-2 requests, including Jobstreet Croatia's existing sender, remain supported. Their missing profile answers leave the corresponding compact cells blank, and their unasked legacy background fields are not displayed. Database mode retains private website copies for authorized downloads. Existing applicant rows stay in the compact tab, with the full pre-migration layout preserved in a hidden native backup tab. Migration does not add missing historical answers or backfill previously synced records.

The schema-7 receiver also accepts the earlier 35-column `A:AI` and deprecated 54-column `A:BB` layouts during rollout. Against 35 columns it retains incoming referral answers in the ID cell's technical note until owner setup restores them to AJ. Deploy this receiver before the owner runs setup. Keep schema 7 deployed after its first compact write: schema 6 cannot read the new referral metadata or write the 36-column layout. Do not manually delete or reorder columns.

## One-time Google authorization and deployment

1. Open the target spreadsheet as its owner. Choose **Extensions → Apps Script**. Name the project `Job Fair 2026 application receiver`.
2. Replace `Code.gs` with the contents of `integrations/google-sheets/Code.gs` from this project.
3. In **Project Settings**, enable **Show appsscript.json manifest file in editor**. Replace that manifest with `integrations/google-sheets/appsscript.json`.
4. Confirm **Drive API v3** and **Google Sheets API v4** appear under **Services** after saving the manifest. They are already declared in the supplied manifest. With a default Apps Script Cloud project, enabling these services enables their APIs automatically. If the script uses a standard Google Cloud project, manually enable the **Google Drive API** and **Google Sheets API** in that linked project. The code uses authenticated REST requests; no service-account key is needed.
5. Add these **Script Properties** in Project Settings:

   | Property | Value |
   | --- | --- |
   | `CHAPTER_SHEET_ID` | `1v9-lAvpJPUCxCqr03EkVwKKAfedEDtckHir4ro6cyeU` |
   | `CHAPTER_SHEET_NAME` | `Applications` |
   | `CHAPTER_WEBHOOK_SECRET` | The same randomly generated secret used by the website server, at least 32 characters. |

6. For a **new installation**, run **setupChapterSync** from the function selector. Authorize the spreadsheet, app-created Drive files, and external Google API requests. This verifies the receiving tab and creates a private **Chapter — Applicant CVs (private)** folder when no folder is already configured. It stores that folder's ID as `CHAPTER_CV_FOLDER_ID`. If the tab is absent, setup creates it; if the tab is empty, setup writes and freezes the compact 36-column header row. For an **existing receiver**, follow the upgrade order below: deploy schema 7 before running setup. Unexpected headers stop setup instead of being overwritten.
7. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Deploy and copy the URL ending in `/exec`. The endpoint accepts only requests carrying a valid server HMAC signature and a timestamp within five minutes. The spreadsheet and CV folder remain private.
8. For Google Sheets storage mode, put these values in the website's server environment, then redeploy or restart the website:

   ```dotenv
   APPLICATION_STORAGE=google-sheets
   CHAPTER_LOCAL_MODE=false
   APP_ORIGIN=https://www.jobsincroatiaa.com
   NEXT_PUBLIC_SITE_URL=https://www.jobsincroatiaa.com
   GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   GOOGLE_SHEETS_WEBHOOK_SECRET=YOUR_RANDOM_SECRET_FROM_SCRIPT_PROPERTIES
   ```

   Preserve the existing matching secret when upgrading the shared receiver. For a new setup, use a password manager or `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"` to generate one. Store it only in Script Properties and the private server environment. Do not commit it or put it in any `NEXT_PUBLIC_` variable. For database mode, leave the mode at its default and add the two Google credentials alongside the database/S3 configuration; see [Vercel setup](VERCEL.md).

9. Read the public `/exec` health response and confirm `service: chapter-applications`, `version: 1`, `schemaVersion: 7`, `columns: 36` and `supportedColumns: [36, 35, 54]`. This describes supported layouts without reading private sheet data. Verify the actual **Applications** headers are `A:AJ`, with **Where did you find us?** at AJ; health alone does not migrate a sheet. Submit a clearly labeled test application from the canonical website with fictitious profile answers and test documents. Confirm the form displays a reference, one matching reference appears in **Applications**, every answer including referral appears in its dedicated column, and the private file links open for the owner. Verify an unchanged retry after a simulated lost acknowledgement remains a single row. In database mode, also confirm the staff portal reports delivery as synced and test a queued retry. Remove the synthetic test row and files after checking. A health response alone does not confirm write authorization or successful production-form delivery.

The Google account owner must complete Google's consent screen and deployment. A connected Sheets editor in this chat does not grant the website an ongoing OAuth token. Automatic delivery is ready only after those server settings and an end-to-end submission succeed.

## CV access and data handling

The receiver requests the limited `drive.file` scope rather than broad access to all Drive files. Its setup creates the CV folder using the same script identity. The optional `CHAPTER_CV_FOLDER_ID` must identify an app-accessible My Drive folder; using setup's folder is recommended. Shared drives are not supported by this receiver.

CV and supporting-document files are not shared publicly. If colleagues need access, share the private applicant folder with their specific Google accounts or a controlled recruiter group. The receiver refuses folders or files shared with `anyone` or an entire domain. Sheet access by itself does not automatically grant file access. Restrict the spreadsheet to the recruiting team because it contains applicant personal information.

Delivery writes literal values to an explicit `A:AJ` row in the current compact layout, `A:AI` during the schema-6 upgrade, or `A:BB` on the recognized deprecated layout. This preserves phone numbers and prevents applicant text from being interpreted as spreadsheet formulas. Explicit coordinates avoid append-table detection shifting values when the first column is hidden. The current form offers nine uploads: the CV plus eight supporting categories. The receiver also accepts the legacy `other` document category, although it is not a current form field or a compact tracker column. The receiver accepts CVs in PDF, DOC or DOCX with matching file extensions and signatures, up to 5 MiB. Supporting files accept these formats plus JPG/PNG, one per category and up to 5 MiB each, with a combined limit of 15 MiB including the CV. Large forms use private staged parts with expiring server-signed tickets; see the Vercel upload transport guide. Only the fully validated final application creates a tracker row. It re-encodes images to remove metadata, and performs detailed DOCX validation before signing the request. Neither upload validation nor this receiver is a malware scanner.

Requests are signed over `timestamp + "." + payload` using HMAC-SHA256. The receiver validates the envelope and bounded application schema before touching Drive or Sheets, serializes deliveries with a script lock, deduplicates application IDs and references, and looks up CVs by private `appProperties` so an interrupted row append can reuse an already uploaded CV. Neither payloads nor secrets are logged. A success acknowledgment includes the application ID, reference and row only after both private CV storage and row insertion are confirmed. Apps Script returns JSON errors; the website must inspect `ok`, not just the HTTP status.

New submissions identified as **Jobs in Croatia** are limited by the shared receiver to 20 per hour in total and three per hour for the same email address. A duplicate retry is exempt so applicants can recover a saved submission. These limits do not change the legacy Jobstreet Croatia request contract.

## Maintenance

- Keep the **Applications** header names and order unchanged. Add analysis, notes or dashboards in another tab. A header mismatch pauses delivery without changing rows.
- In database mode, keep the website's retry worker enabled in production and inspect delivery status in the staff portal. In Google Sheets mode, applicants retry delivery failures from the open form; there is no background website queue. Apps Script and Google API quotas can temporarily interrupt delivery.
- After editing receiver code, update the existing deployment to a **new version** under **Deploy → Manage deployments**; saving the editor alone does not update `/exec`.
- To upgrade an existing tracker, preserve the deployment URL, Script Properties, matching secret and private Drive folder. First update the **existing deployment** to schema 7, which accepts 36-, 35- and 54-column layouts. Then the owner runs `setupChapterSync`. Setup makes a verified native duplicate named **Applications backup YYYY-MM-DD** (adding a numeric suffix if needed) and hides it. On a 35-column tracker it appends AJ without moving A:AI and restores any referral answers retained in technical notes during rollout. On a 54-column tracker it performs the existing compaction, retains historical referral answers, and restores them at AJ. Existing A:AI values, notes and formatting stay intact; filter criteria and the first three frozen columns are preserved. AJ receives the shared referral dropdown. Unexpected headers stop migration; repeating setup is safe. Migration is owner-only and never runs during public submission.
- After migration, verify the 36 `A:AJ` headers, retained references and document links, hidden backup, and a complete synthetic submission including referral. Version-1 CV-only and version-2 supporting-file requests remain supported; version 3 still carries structured profile answers and additional document categories. Payload version 3 does not become version 7. Legacy readiness/background fields remain accepted in the request but are not displayed in the compact tracker. Interrupted retries reuse files by their application and document IDs.
- Previously synced applications are not automatically re-enqueued or backfilled. Any historical export must explicitly select the intended records and verify their IDs and existing file links; normal delivery retries remain idempotent.
- Rotate the secret in both private environments together. Restart the server after changing its environment.
- In Google Sheets mode, staff manage the saved application in the private tracker and Drive. In database mode, use the website's staff portal as the source of truth for later status changes; the Google row captures the status when sent, and editing a sheet cell does not update the website.
- If deployment to **Anyone** is unavailable under a managed Workspace policy, use an authenticated server integration approved by the account administrator. Do not make the spreadsheet public as a workaround.

## Google API references

- [Apps Script web-app deployment and execution identity](https://developers.google.com/apps-script/guides/web)
- [Apps Script explicit OAuth scopes](https://developers.google.com/apps-script/concepts/scopes)
- [Enabling advanced services and their Cloud APIs](https://developers.google.com/apps-script/guides/services/advanced)
- [Drive per-file access scope](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Drive resumable uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Drive private app properties](https://developers.google.com/workspace/drive/api/guides/properties)
- [Sheets RAW values](https://developers.google.com/workspace/sheets/api/guides/values)
