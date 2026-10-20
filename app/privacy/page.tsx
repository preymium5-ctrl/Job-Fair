import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Privacy notice",
  alternates: { canonical: "/privacy" },
  robots: { index: false, follow: true },
};
export default function Privacy() {
  return (
    <div className="container information-page">
      <div className="breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Privacy</span>
      </div>
      <span className="eyebrow">Development preview / Data handling</span>
      <h1 className="page-heading">
        Your information.
        <br />
        <span className="subtle-text">Handled with care.</span>
      </h1>
      <div className="legal-content">
        <p>
          This notice describes how this development installation handles
          application information. It is a preview notice, not a final
          recruitment agency privacy policy. The site owner must provide the
          responsible organization, privacy contact, retention schedule, and any
          applicable legal basis before accepting real applicants.
        </p>
        <h2>Information you choose to provide</h2>
        <p>
          The application form collects your first and last names, gender,
          address, date and place of birth, email address, telephone
          number, country of residence, current work country, destination country,
          job choices, English-language response, professional background, resume,
          optional Telegram contact and parents’ names, terms acknowledgement,
          employer preference, NC2 certificate details, driver’s license
          details and a license copy where applicable, passport, residence ID,
          optional diploma or education certificate, employment certificate and
          other supporting documents, and optional
          cover letter. A license number is not needed. Please do not include bank
          information, medical records, or other unnecessary sensitive
          information.
        </p>
        <h2>How applications are used</h2>
        <p>
          The information is associated with the position you select and made
          available to authorized recruitment staff for reviewing that
          application. Applications can express interest in work in Croatia,
          Slovenia, Serbia, Romania, Macedonia or Montenegro. This local
          installation stores applications for authorized staff review and does
          not automatically forward them to employers. Submission records your
          interest and does not guarantee an interview or employment.
        </p>
        <h2>Recruitment records in Google</h2>
        <p>
          Application details, including optional driver’s license information, may be copied
          to the recruiting team’s Google Sheets tracker. A private copy of your
          CV and supporting documents may be stored in the team’s Google Drive, with links in that
          tracker. The website sends this information through its authorized
          server connection. Uploaded files are not shared publicly; only Google
          accounts authorized by the recruiting team can open them.
        </p>
        <p>
          The current application requires a CV, passport and residence ID.
          Driver applicants must also attach their driver’s license from the
          Philippines, showing the front and back.
          You can also attach a diploma or education certificate, NC2 certificate,
          employment certificate, NBI clearance, Form 18a for Croatia applicants,
          a driver’s license copy for other roles, and another document relevant
          to your application. Requests for correction
          or deletion should include your reference so staff can locate both
          website and Google records.
        </p>
        <p>
          Passport, residence ID and employment-certificate files remain in the
          website’s private storage and are also copied to the recruiting team’s
          private Google Drive. The tracker includes separate columns for each
          form answer and document link. These files require authorized access.
        </p>
        <h2>Storage and access</h2>
        <p>
          In local development, applications are stored in a durable database on
          the host computer, and uploaded files are stored outside the public
          website directory. In a configured production installation, a
          PostgreSQL database and private object storage are used. Recruitment
          staff must sign in to view applicant records and download resumes.
          Administrative changes and resume downloads are recorded in the audit
          log.
        </p>
        <h2>Cookies and security records</h2>
        <p>
          The public website does not use advertising or analytics cookies.
          Staff sign-in uses an essential HTTP-only session cookie. Security
          rate limiting stores a hashed identifier for requests and a time
          window to help prevent automated abuse. Submitted information is
          validated on the server.
        </p>
        <h2>Your choices and retention</h2>
        <p>
          Keep the reference number displayed after submission. To request
          access, correction, or deletion, contact the site owner or the
          confirmed recruitment contact on{" "}
          <Link href="/contact">Application help</Link>. This preview does not
          implement a published automatic retention schedule; the site owner
          must establish one before processing real applicant information. Use
          fictitious details when testing.
        </p>
        <h2>Before live recruitment</h2>
        <p>
          The operator must finalize this notice for its organization and
          jurisdiction, configure HTTPS and private storage, set a retention and
          deletion policy, and confirm the purpose and recipients of applicant
          information. No application is sold or sent to an employer by this
          preview.
        </p>
        <p>Preview notice updated 20 October 2026.</p>
      </div>
    </div>
  );
}
