# Google Sheets application delivery

A signed server request sends the tracker details, structured profile answers, CV and all supplied supporting files to the Apps Script receiver, which saves private Drive files and writes their links in one row in the selected Google Sheet. There are two website storage modes:

- **Google Sheets mode** (`APPLICATION_STORAGE=google-sheets`): the server validates the current profile form and its uploads, then waits for a matching Google acknowledgement before confirming the reference. Legacy API submissions without a profile are rejected in this mode. The private Google Sheet and Drive folder are the recruiting workspace. No website database, S3 bucket or background outbox is used. If delivery fails, the applicant must retry from the open form, which retains its files and retry key. An unchanged retry reuses the application identity to recover a lost acknowledgement without duplicating the row.
- **Database mode** (default): the website stores the application and private uploads before attempting delivery, and retains a failed delivery in its database queue. A confirmed website reference therefore does not by itself mean Google has received the row. Staff can inspect and retry delivery in `/admin`; Vercel requires an external worker for reliable automatic retries.

In both modes, missing or incorrect `APP_ORIGIN` rejects the submission before delivery. Set it to the exact canonical browser origin and redeploy after changing production environment settings. Importing a repository does not copy its private `.env.local`.

The reference form does not collect a most recent role, years of experience or a separate skills statement. The website sends these unanswered fields as empty strings and `null` years. The receiver uses 54 columns and advertises `schemaVersion: 5`; publish it and run its header migration before sending version-3 profile payloads. Earlier receivers reject the expanded payloads. Database-mode requests remain queued for retry; Google Sheets mode reports a delivery error and requires an applicant retry after the receiver is fixed. A checked-in source change alone does not confirm which version is deployed.

Version-3 profile payloads include each profile answer separately, so recruitment staff can filter and review those answers in dedicated columns. The existing **Professional summary** cell retains readable labeled profile lines and document filenames for searches and older records; profile submissions still cap the optional applicant summary at 1,000 characters. Passport, residence ID and employment-certificate uploads join the other supplied documents in private Google Drive storage, with dedicated links in the tracker. Database mode also retains private website copies for authorized staff downloads. Existing application records are unchanged; upgrading the receiver does not automatically backfill already synced rows.

Target spreadsheet: [Job Fair 2026](https://docs.google.com/spreadsheets/d/1v9-lAvpJPUCxCqr03EkVwKKAfedEDtckHir4ro6cyeU/edit). The receiving tab is **Applications**. The receiver is pinned to this spreadsheet ID and checks all 54 column headers before writing. The original A:AD positions are preserved. Columns W:AA hold diploma, NC2, NBI/apostille, Form 18a and other-document links. Columns AB:AC hold optional driver license details and a private document link. Column AD holds the optional referral source and accepts either **Where did you hear about us?** or Jobstreet Croatia's **How did you hear about us?** header without renaming it. Both `referralSource` and the legacy `discoverySource` payload key are supported. The four retired document-status columns remain absent; the staff-managed application status remains.

The appended columns are:

| Columns | Content |
| --- | --- |
| AE:AI | First name, last name, gender, optional legacy nationality, current address / location |
| AJ:AM | Street, city, province / state, postal code |
| AN:AQ | Date of birth, place of birth, father's full name, mother's full name |
| AR:AU | Destination country, current work country, additional experienced role, other job choice |
| AV:AX | English proficiency, Telegram number, terms accepted |
| AY:BA | Private passport, residence ID and employment-certificate links |
| BB | Application source, identifying the submitting website |

The WhatsApp/contact number remains in column E. The application form displays **Macedonia**; historical `North Macedonia` answers remain accepted. Legacy version-1 and version-2 requests, including Jobstreet Croatia's existing sender, remain supported. Answers absent from those requests leave the new columns blank. Existing applicant rows and unrelated tabs are preserved.

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

6. Run **setupChapterSync** from the function selector. Authorize the spreadsheet, app-created Drive files, and external Google API requests. This verifies the receiving tab and creates a private **Chapter — Applicant CVs (private)** folder when no folder is already configured. It stores that folder's ID as `CHAPTER_CV_FOLDER_ID`. If the tab is absent, setup creates it; if the tab is empty, setup writes and freezes the expected header row. For a recognized older layout, setup adds the missing headers while preserving existing answers and the accepted AD header alias. Unexpected headers stop setup instead of being overwritten.
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

9. Read the public `/exec` health response and confirm `service: chapter-applications`, `version: 1`, `schemaVersion: 5` and `columns: 54`. Submit a clearly labeled test application from the canonical website with fictitious profile answers and test documents. Confirm the form displays a reference, one matching reference appears in **Applications**, every answer appears in its dedicated column, and the private file links open for the owner. Verify an unchanged retry after a simulated lost acknowledgement remains a single row. In database mode, also confirm the staff portal reports delivery as synced and test a queued retry. Remove the synthetic test row and files after checking. A health response alone does not confirm write authorization or successful production-form delivery.

The Google account owner must complete Google's consent screen and deployment. A connected Sheets editor in this chat does not grant the website an ongoing OAuth token. Automatic delivery is ready only after those server settings and an end-to-end submission succeed.

## CV access and data handling

The receiver requests the limited `drive.file` scope rather than broad access to all Drive files. Its setup creates the CV folder using the same script identity. The optional `CHAPTER_CV_FOLDER_ID` must identify an app-accessible My Drive folder; using setup's folder is recommended. Shared drives are not supported by this receiver.

CV and supporting-document files are not shared publicly. If colleagues need access, share the private applicant folder with their specific Google accounts or a controlled recruiter group. The receiver refuses folders or files shared with `anyone` or an entire domain. Sheet access by itself does not automatically grant file access. Restrict the spreadsheet to the recruiting team because it contains applicant personal information.

Delivery writes an explicit `A:BB` row with `valueInputOption=RAW`, preserving phone numbers and preventing applicant text from being interpreted as spreadsheet formulas. Explicit coordinates avoid append-table detection shifting values when the first column is hidden. The receiver accepts CVs in PDF, DOC or DOCX with matching file extensions and signatures, up to 5 MiB for legacy requests. Up to nine supporting files accept these formats plus JPG/PNG, one per category and up to 3 MiB each, with a combined receiver limit of 15 MiB including the CV. The website applies stricter profile limits of 3 MiB per file and 4 MiB combined. It re-encodes images to remove metadata, and performs detailed DOCX validation before signing the request. Neither upload validation nor this receiver is a malware scanner.

Requests are signed over `timestamp + "." + payload` using HMAC-SHA256. The receiver validates the envelope and bounded application schema before touching Drive or Sheets, serializes deliveries with a script lock, deduplicates application IDs and references, and looks up CVs by private `appProperties` so an interrupted row append can reuse an already uploaded CV. Neither payloads nor secrets are logged. A success acknowledgment includes the application ID, reference and row only after both private CV storage and row insertion are confirmed. Apps Script returns JSON errors; the website must inspect `ok`, not just the HTTP status.

New submissions identified as **Jobs in Croatia** are limited by the shared receiver to 20 per hour in total and three per hour for the same email address. A duplicate retry is exempt so applicants can recover a saved submission. These limits do not change the legacy Jobstreet Croatia request contract.

## Maintenance

- Keep the **Applications** header names and order unchanged. Add analysis, notes or dashboards in another tab. A header mismatch pauses delivery without changing rows.
- In database mode, keep the website's retry worker enabled in production and inspect delivery status in the staff portal. In Google Sheets mode, applicants retry delivery failures from the open form; there is no background website queue. Apps Script and Google API quotas can temporarily interrupt delivery.
- After editing receiver code, update the existing deployment to a **new version** under **Deploy → Manage deployments**; saving the editor alone does not update `/exec`.
- To upgrade a recognized legacy 26-, 27-, 29-, 30- or 31-column layout, preserve the current deployment URL, script properties, matching secret and private folder. Coordinate delivery workers for both websites while running `setupChapterSync` and updating the existing deployment, since an old receiver rejects the expanded header row. Setup checks the legacy headers, removes the four retired document-status columns only when present, and appends missing headers through BB without rewriting applicant rows. It preserves either recognized source header at AD. Incompatible headers stop migration; repeating setup does not remove more columns. Header migration is owner-only and does not run automatically during application submission. Confirm `schemaVersion: 5` and `columns: 54` before resuming delivery. Version-1 CV-only and version-2 supporting-file requests remain supported; version 3 adds structured profile answers and the three additional document categories. Legacy readiness fields remain accepted but are not written to the spreadsheet. Interrupted retries reuse each file by its application and document IDs.
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
