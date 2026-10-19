# Google Sheets application delivery

The website stores each application, private CV and supporting files before attempting Google delivery. A signed server request sends the tracker details, CV and supported Google file categories to the Apps Script receiver, which saves private Drive files and writes their links in one row in the selected Google Sheet. The identity and employment-file exceptions are described below. A failed delivery remains queued in the website database for retry. Saving an application locally is separate from confirming delivery to Google.

The reference form does not collect a most recent role, years of experience or a separate skills statement. The website stores these unanswered fields as empty strings and `null` years. The existing production Apps Script deployment was updated to version 8 on October 20, 2026 to accept empty role/skills and null years, writing a blank experience cell. This requires no header migration: all 30 columns, the schema number and existing complete payloads remain supported. Other installations must publish the updated receiver source; earlier numeric-only receivers reject these new deliveries, which remain queued for retry after they are updated.

All profile answers are formatted as readable labeled lines in the existing **Professional summary** column, together with a note identifying the unasked background questions. Profile submissions cap any optional summary at 1,000 characters so all profile answers and private-document filenames fit the receiver's 4,000-character summary limit. Passport, residence ID and employment-certificate files remain in the website's private storage and authorized staff workspace; their labeled filenames and a workspace-access note appear in this same cell. These three file categories are not sent to Google Drive. CV, diploma and the original supporting categories retain their existing exports and column locations. Existing application records remain unchanged.

Target spreadsheet: [Job Fair 2026](https://docs.google.com/spreadsheets/d/1v9-lAvpJPUCxCqr03EkVwKKAfedEDtckHir4ro6cyeU/edit). The receiving tab is **Applications**. The receiver is pinned to this spreadsheet ID and checks all 30 column headers before writing. Columns W:AA hold diploma, NC2, NBI/apostille, Form 18a and other-document links. Columns AB:AC hold optional driver license details and a private document link. Column AD, **Where did you hear about us?**, holds the optional referral source; older applications leave it blank. The four document-status columns have been removed; the staff-managed application status remains. Existing applicant rows and unrelated tabs are preserved.

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

6. Run **setupChapterSync** from the function selector. Authorize the spreadsheet, app-created Drive files, and external Google API requests. This verifies the receiving tab and creates a private **Chapter — Applicant CVs (private)** folder. It stores that folder's ID as `CHAPTER_CV_FOLDER_ID`. If the tab is absent, setup creates it; if the tab is empty, setup writes and freezes the expected header row. If any existing header differs, setup stops instead of overwriting it.
7. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Deploy and copy the URL ending in `/exec`. The endpoint accepts only requests carrying a valid server HMAC signature and a timestamp within five minutes. The spreadsheet and CV folder remain private.
8. Put the deployment URL and matching secret in the website's server environment, then restart the website:

   ```dotenv
   GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   GOOGLE_SHEETS_WEBHOOK_SECRET=YOUR_RANDOM_SECRET_FROM_SCRIPT_PROPERTIES
   ```

   Use a password manager or `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"` to generate a new secret. Store it only in Script Properties and the private server environment. Do not commit it or put it in any `NEXT_PUBLIC_` variable.

9. Submit a clearly labeled test application with a test CV. Confirm one matching reference appears in **Applications**, the CV link opens for the owner, and the website reports delivery as synced. Retry that same queued application to verify it remains a single row. Remove the synthetic test row and test CV after checking. A health response from `/exec` alone does not confirm write authorization or successful application delivery.

The Google account owner must complete Google's consent screen and deployment. A connected Sheets editor in this chat does not grant the website an ongoing OAuth token. Automatic delivery is ready only after those server settings and an end-to-end submission succeed.

## CV access and data handling

The receiver requests the limited `drive.file` scope rather than broad access to all Drive files. Its setup creates the CV folder using the same script identity. The optional `CHAPTER_CV_FOLDER_ID` must identify an app-accessible My Drive folder; using setup's folder is recommended. Shared drives are not supported by this receiver.

CV files are not shared publicly. If colleagues need access, share the CV folder with their specific Google accounts or a controlled recruiter group. The receiver refuses folders or files shared with `anyone` or an entire domain. Sheet access by itself does not automatically grant CV access. Restrict the spreadsheet to the recruiting team because it contains applicant personal information.

Delivery writes an explicit `A:AD` row with `valueInputOption=RAW`, preserving phone numbers and preventing applicant text from being interpreted as spreadsheet formulas. Explicit coordinates avoid append-table detection shifting values when the first column is hidden. CVs must be PDF, DOC or DOCX, with matching file extensions and signatures, and no larger than 5 MiB. Up to six optional supporting files accept these formats plus JPG/PNG, up to 3 MiB each, with a combined 15 MiB limit including the CV. The website re-encodes images to remove metadata. Detailed DOCX validation also runs on the website before the signed request is produced. Neither upload validation nor this receiver is a malware scanner.

Requests are signed over `timestamp + "." + payload` using HMAC-SHA256. The receiver validates the envelope and bounded application schema before touching Drive or Sheets, serializes deliveries with a script lock, deduplicates application IDs and references, and looks up CVs by private `appProperties` so an interrupted row append can reuse an already uploaded CV. Neither payloads nor secrets are logged. A success acknowledgment includes the application ID, reference and row only after both private CV storage and row insertion are confirmed. Apps Script returns JSON errors; the website must inspect `ok`, not just the HTTP status.

## Maintenance

- Keep the **Applications** header names and order unchanged. Add analysis, notes or dashboards in another tab. A header mismatch pauses delivery without changing rows.
- Keep the website's retry worker enabled in production and inspect delivery status in the staff portal. Apps Script and Google API quotas can temporarily delay delivery.
- After editing receiver code, update the existing deployment to a **new version** under **Deploy → Manage deployments**; saving the editor alone does not update `/exec`.
- To upgrade a legacy 26-, 27-, 29- or 31-column receiver, replace its source, run `setupChapterSync`, then update the existing deployment. Setup checks the exact legacy headers, removes the four document-status columns only when present, and adds document-link, driver license and referral-source headers if needed. Existing 29-column sheets gain only the appended referral-source header in AD; no old answer is inferred or filled. Applicant details, application status and file links retain their alignment. Incompatible headers stop migration; repeating setup does not remove more columns. Header migration is owner-only and does not run automatically during application submission. The updated health response reports `schemaVersion: 4` and `columns: 30`. Version-1 CV-only requests remain supported; version-2 requests include supporting files. Existing signed payloads retain their legacy readiness fields for receiver compatibility, but these fields are not written to the spreadsheet. Interrupted retries reuse each file by its application and document IDs.
- Rotate the secret in both private environments together. Restart the server after changing its environment.
- Use the website's staff portal as the source of truth for later application-status changes. Sheet delivery captures the status when the application is sent; editing a sheet cell does not update the website.
- If deployment to **Anyone** is unavailable under a managed Workspace policy, use an authenticated server integration approved by the account administrator. Do not make the spreadsheet public as a workaround.

## Google API references

- [Apps Script web-app deployment and execution identity](https://developers.google.com/apps-script/guides/web)
- [Apps Script explicit OAuth scopes](https://developers.google.com/apps-script/concepts/scopes)
- [Enabling advanced services and their Cloud APIs](https://developers.google.com/apps-script/guides/services/advanced)
- [Drive per-file access scope](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Drive resumable uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Drive private app properties](https://developers.google.com/workspace/drive/api/guides/properties)
- [Sheets RAW values](https://developers.google.com/workspace/sheets/api/guides/values)
