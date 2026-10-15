import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Terms of use",
  alternates: { canonical: "/terms" },
  robots: { index: false, follow: true },
};
export default function Terms() {
  return (
    <div className="container information-page">
      <div className="breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Terms of use</span>
      </div>
      <span className="eyebrow">Development preview / Website use</span>
      <h1 className="page-heading">
        A clear
        <br />
        <span className="subtle-text">understanding.</span>
      </h1>
      <div className="legal-content">
        <p>
          Jobs in Croatia is currently a recruitment platform development preview. The
          current catalogue includes the 248 positions allocated across six
          employers in the Job Fair Philippines 2026 plan dated 29 September 2026.
          A listing or application is not an offer of employment.
        </p>
        <h2>Opportunity information</h2>
        <p>
          Salary ranges were supplied separately from
          the PDF. Employer allocations, testing plans, and NC2 guidance follow
          the dated event plan; role descriptions and experience guidance remain
          indicative. Final salary, benefits, work
          arrangements, and eligibility criteria must be supplied before a
          vacancy is presented as genuine. A listing does not promise placement
          or an employment outcome.
        </p>
        <h2>Submitting an application</h2>
        <p>
          Applications are associated with the selected position and receive a
          reference only after the server stores them successfully. Applying
          does not guarantee an interview, selection, employment, or a response
          within a specific timeframe. Use fictitious information when trying an
          example role.
        </p>
        <h2>Responsible use</h2>
        <p>
          Submit information you are entitled to share. Do not upload malicious
          files, unrelated sensitive documents, or information about other
          people without their permission. Do not attempt to access another
          applicant’s records or the staff administration area without
          authorization.
        </p>
        <h2>Privacy and support</h2>
        <p>
          See the <Link href="/privacy">privacy notice</Link> for how this
          preview handles data. <Link href="/contact">Application help</Link>{" "}
          provides practical guidance and any confirmed recruitment contact
          details.
        </p>
        <h2>Production terms</h2>
        <p>
          The site operator must provide its legal identity,
          jurisdiction-specific terms, and recruitment policies before live
          operation. These preview terms do not represent a verified recruitment
          agency’s policies.
        </p>
        <p>Preview terms updated 15 October 2026.</p>
      </div>
    </div>
  );
}
