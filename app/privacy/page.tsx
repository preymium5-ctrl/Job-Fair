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
      <span className="eyebrow">Application privacy / Data handling</span>
      <h1 className="page-heading">
        Your information.
        <br />
        <span className="subtle-text">Handled with care.</span>
      </h1>
      <div className="legal-content">
        <p>
          This notice describes how Jobs in Croatia handles the information
          you submit through its application form. For questions about your
          application or the organization responsible for handling it, use the
          contact details on <Link href="/contact">Application help</Link>.
        </p>
        <h2>Information you choose to provide</h2>
        <p>
          The application form collects your first and last names, gender,
          address, date and place of birth, email address, telephone
          number, country of residence, current work country, destination country,
          job choices, English proficiency, professional background, resume,
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
          Slovenia, Serbia, Romania, Macedonia or Montenegro. Applications are
          stored for authorized recruitment staff review. Submission records your
          interest and does not guarantee an interview or employment.
        </p>
        <h2>Recruitment records in Google</h2>
        <p>
          Application details, including optional driver’s license information,
          are sent to the recruiting team’s Google Sheets tracker when Google
          delivery is enabled. Your CV and supporting documents are stored in
          the team’s private Google Drive, with links in that
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
          Passport, residence ID and employment-certificate files are included
          in this private document storage. The tracker includes separate
          columns for each form answer and document link. These files require
          authorized access.
        </p>
        <h2>Storage and access</h2>
        <p>
          When this website uses Google Sheets storage, authorized recruitment
          staff review your information in the private tracker and Drive folder.
          The website confirms your application reference only after Google
          acknowledges the saved application. If submission fails, keep the
          form open and retry; your selected files remain in the form during
          that retry. Repeating an unchanged submission reuses its application
          identity to prevent a second row after a lost confirmation.
        </p>
        <p>
          Installations using the database backend also retain application
          records in a database and uploads in private object storage. Staff
          must sign in to use that installation’s recruitment workspace;
          administrative changes and file downloads are recorded in its audit
          log. Local development keeps test records and files on the host
          computer, outside the public website directory.
        </p>
        <h2>Cookies and security records</h2>
        <p>
          The public website does not use advertising or analytics cookies.
          Staff sign-in uses an essential HTTP-only session cookie. Security
          rate limiting stores a hashed identifier for requests and a time
          window to help prevent automated abuse. The Google receiver also
          checks submission frequency using application records and email
          addresses. Submitted information and uploaded file formats are
          validated on the server.
        </p>
        <h2>Your choices and retention</h2>
        <p>
          Keep the reference number displayed after submission. To request
          access, correction, or deletion, contact the site owner or the
          confirmed recruitment contact on{" "}
          <Link href="/contact">Application help</Link>. There is no automatic
          deletion schedule implemented by the website. The recruiting team
          handles retention and deletion requests for its application records
          and private document copies. Use fictitious details when testing.
        </p>
        <h2>About your submission</h2>
        <p>
          Submitting this form provides your information to the recruiting
          team for reviewing your application. It does not automatically send
          an application to an employer. Contact the recruiting team for
          information about any later sharing with an employer.
        </p>
        <p>Notice updated 20 October 2026.</p>
      </div>
    </div>
  );
}
