
export const applicationFaqs = [
  [
    "How do I apply for a job?",
    "Find a role that fits your experience, read its requirements, and select Apply now. Complete the application form, attach your documents, and submit. Each application is linked to the position you choose.",
  ],
  [
    "What documents may be required?",
    "Attach your current CV and valid passport. Residence ID is optional. Driver applicants must also attach their Philippine driver’s license, showing the front and back. You can attach available diploma, NC2, employment, NBI clearance, and other relevant documents; Form 18a applies to Croatia applicants. Your CV must be a PDF, DOC, or DOCX file up to 3 MB. Supporting documents accept PDF, DOC, DOCX, JPG, or PNG files up to 3 MB each, with all uploads together within 4 MB. You can apply while work permit documents are still in progress.",
  ],
  [
    "Can I apply for multiple positions?",
    "Yes. Submit a separate application for each position that matches your skills. Tailor your professional summary to the role and keep the reference number for each application.",
  ],
  [
    "How will I know my application was received?",
    "After a successful submission, a confirmation appears with your position and a unique reference number. Save that reference. If an error appears, your application has not been confirmed and you can try again.",
  ],
  [
    "What happens after I apply?",
    "The recruitment team reviews the information you provide. Shortlisted applicants may be invited to an interview or skills assessment. The stages and timing depend on the position and employer; submission does not guarantee selection.",
  ],
  [
    "Where can I find salary details?",
    "Official job listings show their salary range and payment period. For additional roles in the application form, ask the recruitment team to confirm the salary, employer, and written employment terms.",
  ],
  [
    "When are interviews and testing?",
    "Shortlisted applicants are contacted by the recruitment team to arrange an interview and any skills assessment required for the role. You will receive your own schedule and preparation instructions.",
  ],
  [
    "How can I contact the recruitment team?",
    "Visit Application help for guidance and available recruitment contact details. Keep your application reference handy so the team can find your records.",
  ],
];
export function Faq({ items = applicationFaqs }: { items?: string[][] }) {
  return (
    <div className="faq-list">
      {items.map(([q, a], i) => (
        <details key={q} className="faq-item">
          <summary>
            <span className="faq-number">0{i + 1}</span>
            <span>{q}</span>
            <span className="faq-plus" aria-hidden="true">
              +
            </span>
          </summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}
