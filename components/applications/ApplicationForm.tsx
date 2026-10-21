"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, FileText, LockKeyhole } from "lucide-react";
import type { ApplicationInput, ApplicationProfile, Job } from "@/lib/types";
import { applicationSchema, fieldErrors } from "@/lib/validation";
import { referralSources } from "@/lib/referral-sources";
import { prepareApplicationUpload, stageApplicationUpload, resetStagedUpload, type PreparedApplicationUpload } from "@/lib/application-upload-client";
import { MAX_PROFILE_UPLOAD_BYTES, MAX_PROFILE_RESUME_BYTES, MAX_SUPPORTING_DOCUMENT_BYTES, SUPPORTING_DOCUMENT_ACCEPT, supportingDocumentTypes, getRequiredProfileDocumentCategories, isDriverPosition, type SupportingDocumentCategory } from "@/lib/document-uploads";
import { countryOptions, destinationCountries, secondaryJobPositions } from "@/data/application-form-options";
import { fairDocuments, fairDocumentTiming, fairNc2Requirements, nc2ElectricalNote } from "@/data/job-fair";
import { BrandLockup } from "@/components/ui/Brand";
import AttachmentUpload from "./AttachmentUpload";
import styles from "./ApplicationForm.module.css";

type FormErrors = Record<string, string | undefined>;
type JobOption = Pick<Job, "id" | "title" | "slug">;
type ProfileTextKey = Exclude<keyof ApplicationProfile, "gender" | "englishProficiency" | "termsAccepted" | "destinationCountry" | "nationality">;
const emptyProfile: ApplicationProfile = {
  firstName: "", lastName: "", gender: "" as ApplicationProfile["gender"], telegram: "",
  address: "", street: "", city: "", province: "", postalCode: "",
  dateOfBirth: "", placeOfBirth: "", fatherName: "", motherName: "", destinationCountry: "Croatia",
  currentWorkCountry: "", secondaryJobTitle: "", otherJobTitle: "", englishProficiency: "" as ApplicationProfile["englishProficiency"], termsAccepted: false,
};
const profileLimits: Partial<Record<ProfileTextKey, number>> = {
  firstName: 60, lastName: 60, telegram: 80, street: 140, city: 60, province: 60, postalCode: 20, placeOfBirth: 120,
  fatherName: 120, motherName: 120, currentWorkCountry: 80, secondaryJobTitle: 160, otherJobTitle: 160,
};
const uploadLabels: Partial<Record<SupportingDocumentCategory, string>> = {
  passport: "Please upload a copy of your valid passport",
  "residence-id": "Please upload your updated and valid residence ID (front & back)",
  diploma: "Please upload your high school diploma",
  "employment-certificate": "Please upload your certificate of employment(s)",
  nc2: "Please upload your valid NC2 certificate",
  nbi: "Please upload your NBI clearance with apostille",
  form18a: "Please upload your Form 18a (for Croatia applicants)",
  "driver-license": "Please upload your driver’s license(s) from the Philippines (front & back)",
};

export default function ApplicationForm({ job, jobs = [job], additionalJobs = [] }: { job: Job; jobs?: JobOption[]; additionalJobs?: JobOption[] }) {
  const [values, setValues] = useState<ApplicationInput>({
    jobId: job.id, fullName: "", email: "", phone: "", country: "", referralSource: "", recentJobTitle: "", experienceYears: null,
    skills: "", education: "", summary: "", coverLetter: "", nc2Certificate: "", preferredEmployer: "",
    profile: { ...emptyProfile, destinationCountry: destinationCountries.find((country) => country === job.location) || emptyProfile.destinationCountry }, consent: false,
  });
  const [resume, setResume] = useState<File | null>(null);
  const [supportingFiles, setSupportingFiles] = useState<Partial<Record<SupportingDocumentCategory, File>>>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [website, setWebsite] = useState("");
  const [result, setResult] = useState<{ reference: string; jobTitle: string } | null>(null);
  const [copyNotice, setCopyNotice] = useState("");
  const [latestBirthDate] = useState(() => new Date(Date.now() - 86400000).toISOString().slice(0, 10));
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submittingRef = useRef(false);
  const idempotencyRef = useRef<string | null>(null);
  const preparedUploadRef = useRef<PreparedApplicationUpload | null>(null);
  const selectedJob = [...jobs, ...additionalJobs].find(({ id }) => id === values.jobId) || job;
  const driverApplicant = isDriverPosition(selectedJob.title);
  const requiredDocumentCategories = getRequiredProfileDocumentCategories(selectedJob.title);

  function update<K extends keyof ApplicationInput>(key: K, value: ApplicationInput[K]) {
    idempotencyRef.current = null;
    preparedUploadRef.current = null;
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "jobId" && current.profile) {
        const title = [...jobs, ...additionalJobs].find(({ id }) => id === value)?.title;
        if (title?.toLowerCase() === current.profile.secondaryJobTitle.toLowerCase())
          next.profile = { ...current.profile, secondaryJobTitle: "" };
      }
      return next;
    });
    setErrors((current) => ({ ...current, [key]: undefined, ...(key === "jobId" ? { "document:driver-license": undefined } : {}) }));
  }
  function updateProfile<K extends keyof ApplicationProfile>(key: K, value: ApplicationProfile[K]) {
    idempotencyRef.current = null;
    preparedUploadRef.current = null;
    setValues((current) => {
      const profile = { ...(current.profile || emptyProfile), [key]: value };
      return { ...current, profile, fullName: `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim(), country: profile.currentWorkCountry };
    });
    setErrors((current) => ({ ...current, [`profile.${key}`]: undefined, fullName: undefined, country: undefined }));
  }
  function showErrors(nextErrors: FormErrors) {
    if (nextErrors.fullName) nextErrors["profile.lastName"] ||= nextErrors.fullName;
    if (nextErrors.country) nextErrors["profile.currentWorkCountry"] ||= nextErrors.country;
    setErrors(nextErrors);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true'], [data-form-error]")?.focus());
  }
  function fileError(file: File, isResume = false) {
    const max = isResume ? MAX_PROFILE_RESUME_BYTES : MAX_SUPPORTING_DOCUMENT_BYTES;
    if (!file.size || file.size > max) return `Choose a non-empty file of ${max / 1024 / 1024} MB or less.`;
    if (!(isResume ? /\.(pdf|doc|docx)$/i : /\.(pdf|doc|docx|jpe?g|png)$/i).test(file.name))
      return isResume ? "Choose a PDF, DOC, or DOCX file." : "Choose a PDF, DOC, DOCX, JPG, or PNG file.";
  }
  function chooseResume(file: File | null) {
    idempotencyRef.current = null;
    preparedUploadRef.current = null;
    setResume(file);
    setErrors((current) => ({ ...current, resume: file ? fileError(file, true) : undefined, documents: undefined }));
  }
  function validateFiles() {
    const nextErrors: FormErrors = {};
    if (!resume) nextErrors.resume = "Please attach your updated CV or resume.";
    else if (fileError(resume, true)) nextErrors.resume = fileError(resume, true);
    for (const { id, label } of supportingDocumentTypes) {
      const file = supportingFiles[id];
      if (!file && requiredDocumentCategories.includes(id))
        nextErrors[`document:${id}`] = `Please attach your ${label.toLowerCase()}.`;
      else if (file && fileError(file)) nextErrors[`document:${id}`] = fileError(file);
    }
    if (totalUploadBytes > MAX_PROFILE_UPLOAD_BYTES)
      nextErrors.documents = `Keep all files together within ${MAX_PROFILE_UPLOAD_BYTES / 1024 / 1024} MB. Choose smaller files or remove an optional attachment.`;
    return nextErrors;
  }
  async function submit() {
    if (submittingRef.current) return;
    const parsed = applicationSchema.safeParse(values);
    const nextErrors: FormErrors = { ...(!parsed.success ? fieldErrors(parsed.error) : {}), ...validateFiles() };
    if (Object.values(nextErrors).some(Boolean)) { showErrors(nextErrors); return; }
    if (!resume || !parsed.success) return;
    submittingRef.current = true;
    setBusy(true); setError(""); setProgress(0);
    idempotencyRef.current ||= crypto.randomUUID();
    const body = new FormData();
    body.append("payload", JSON.stringify(parsed.data));
    body.append("resume", resume);
    for (const { id } of supportingDocumentTypes) if (supportingFiles[id]) body.append(`document:${id}`, supportingFiles[id]!);
    body.append("website", website);
    body.append("idempotencyKey", idempotencyRef.current);
    const fail = (message: string) => { setError(message); setBusy(false); submittingRef.current = false; };
    let transmission: Awaited<ReturnType<typeof stageApplicationUpload>>;
    try {
      if (preparedUploadRef.current?.key !== idempotencyRef.current)
        preparedUploadRef.current = await prepareApplicationUpload(body, idempotencyRef.current);
      transmission = await stageApplicationUpload(preparedUploadRef.current, setProgress);
    } catch (error) {
      fail(error instanceof Error ? error.message : "We couldn’t upload your files. Select Submit to retry.");
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/applications");
    xhr.timeout = 300000;
    if (transmission.contentType) xhr.setRequestHeader("Content-Type", transmission.contentType);
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round((transmission.staged ? 90 : 0) + (event.loaded / event.total) * (transmission.staged ? 10 : 100))); };
    xhr.onerror = () => fail("We couldn’t connect. Your application has not been confirmed. Check your connection and try again.");
    xhr.ontimeout = () => fail("The request timed out. Try again; your reference will be recovered if the application was received.");
    xhr.onload = () => {
      if (xhr.status === 413) {
        showErrors({ documents: "Choose files of 5 MB or less, with all files together within 15 MB." });
        fail("We couldn’t transfer the files. Check their sizes and select Submit to retry."); return;
      }
      let response: { error?: string; code?: string; fieldErrors?: FormErrors; reference?: string; jobTitle?: string };
      try { response = JSON.parse(xhr.responseText); }
      catch { fail("We couldn’t confirm your application. Please try again."); return; }
      if (xhr.status >= 200 && xhr.status < 300 && response.reference && response.jobTitle) {
        setResult({ reference: response.reference, jobTitle: response.jobTitle });
        preparedUploadRef.current = null;
        setBusy(false);
        requestAnimationFrame(() => headingRef.current?.focus());
      } else {
        if (["UPLOAD_STAGE_EXPIRED", "UPLOAD_STAGE_NOT_FOUND", "UPLOAD_STAGE_CONFLICT"].includes(response.code || "") && preparedUploadRef.current) resetStagedUpload(preparedUploadRef.current);
        if (response.fieldErrors) showErrors(response.fieldErrors);
        fail(response.error || "We couldn’t submit your application. Please check your details and try again.");
      }
    };
    xhr.send(transmission.body);
  }

  function textField(key: ProfileTextKey, label: string, options: { optional?: boolean; wide?: boolean; type?: string; autoComplete?: string; placeholder?: string; help?: string; icon?: ReactNode } = {}) {
    const id = `profile.${key}`;
    return <div className={`${styles.field} ${options.wide ? styles.full : ""}`}>
      <label htmlFor={id}>{options.icon}{label}{options.optional ? <span className={styles.optional}>Optional</span> : <span className={styles.asterisk}>*</span>}</label>
      <input id={id} name={id} value={String(values.profile?.[key] || "")} type={options.type || "text"}
        autoComplete={options.autoComplete} maxLength={profileLimits[key]} placeholder={options.placeholder}
        max={options.type === "date" ? latestBirthDate : undefined}
        disabled={busy} aria-required={!options.optional} aria-invalid={Boolean(errors[id])}
        aria-describedby={[options.help ? `${id}-help` : "", errors[id] ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}
        onChange={(event) => updateProfile(key, event.target.value)} />
      {options.help && <p className={styles.help} id={`${id}-help`}>{options.help}</p>}
      {errors[id] && <p className={styles.fieldError} id={`${id}-error`}>{errors[id]}</p>}
    </div>;
  }
  function profileSelect<K extends "currentWorkCountry" | "secondaryJobTitle" | "destinationCountry">(key: K, label: string, options: readonly string[], wide = true, help?: string) {
    const id = `profile.${key}`;
    return <div className={`${styles.field} ${wide ? styles.full : ""}`}>
      <label htmlFor={id}>{label}<span className={styles.asterisk}>*</span></label>
      <select id={id} name={id} value={values.profile?.[key] || ""} disabled={busy} aria-required="true" aria-invalid={Boolean(errors[id])}
        aria-describedby={[help ? `${id}-help` : "", errors[id] ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}
        onChange={(event) => updateProfile(key, event.target.value as ApplicationProfile[K])}>
        <option value="">Select an option</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {help && <p className={styles.help} id={`${id}-help`}>{help}</p>}
      {errors[id] && <p className={styles.fieldError} id={`${id}-error`}>{errors[id]}</p>}
    </div>;
  }
  function choice<K extends "gender" | "englishProficiency">(key: K, label: string, options: ApplicationProfile[K][], wide = false) {
    const id = `profile.${key}`;
    return <fieldset className={`${styles.choiceField} ${wide ? styles.full : ""}`} tabIndex={-1} aria-invalid={Boolean(errors[id])} aria-describedby={errors[id] ? `${id}-error` : undefined}>
      <legend>{label}<span className={styles.asterisk}>*</span></legend>
      <div className={styles.choices}>{options.map((option) => <label key={option}><input type="radio" name={id} value={option} checked={values.profile?.[key] === option} disabled={busy} onChange={() => updateProfile(key, option)} /><span>{option}</span></label>)}</div>
      {errors[id] && <p className={styles.fieldError} id={`${id}-error`}>{errors[id]}</p>}
    </fieldset>;
  }
  function upload(category: SupportingDocumentCategory) {
    const hints: Partial<Record<SupportingDocumentCategory, string>> = {
      passport: "A clear copy of your passport, valid for at least 2 years.",
      "residence-id": "For Filipinos currently outside the Philippines: upload the valid residence ID issued by your current country of residence. Combine the front and back in one readable file.",
      diploma: "Needed for the work permit application. Upload your high school diploma now if available.",
      "employment-certificate": "A certificate of employment or employment contract showing your experience.",
      nc2: "Needed for the work permit application. Check the position guide above and upload your certificate if available.",
      nbi: "Needed for the work permit application. Combine your NBI clearance and apostille in one file, if available.",
      form18a: "For Croatia applicants. Upload your completed Form 18a if available for the work permit application.",
      "driver-license": driverApplicant ? "Required for driver applicants. Combine the front and back of your valid Philippine driver’s license in one readable file." : "Required for driver applicants; optional for other positions. Combine the front and back in one file, if available.",
    };
    return <AttachmentUpload id={`attachment-${category}`} label={uploadLabels[category] || category}
      required={requiredDocumentCategories.includes(category)} hint={hints[category] || "Attach a clear, readable copy."}
      accept={SUPPORTING_DOCUMENT_ACCEPT} maxBytes={MAX_SUPPORTING_DOCUMENT_BYTES} file={supportingFiles[category] || null}
      error={errors[`document:${category}`]} disabled={busy} onChange={(file) => {
        idempotencyRef.current = null;
        preparedUploadRef.current = null;
        setSupportingFiles((current) => ({ ...current, [category]: file || undefined }));
        setErrors((current) => ({ ...current, [`document:${category}`]: file ? fileError(file) : undefined, documents: undefined }));
      }} />;
  }
  const totalUploadBytes = Object.values(supportingFiles).reduce((sum, file) => sum + (file?.size || 0), resume?.size || 0);
  const requiredAttachments = [
    { label: "CV / Resume", ready: Boolean(resume && !fileError(resume, true)) },
    ...requiredDocumentCategories.map((id) => ({ label: supportingDocumentTypes.find((item) => item.id === id)!.label, ready: Boolean(supportingFiles[id] && !fileError(supportingFiles[id]!)) })),
  ];
  const readyCount = requiredAttachments.filter(({ ready }) => ready).length;
  const errorCount = Object.values(errors).filter(Boolean).length;

  return <div className={styles.page}>
    <div className={styles.shell}>
      <Link href={`/jobs/${job.slug}`} className={styles.back}><ArrowLeft size={16} /> Back to the opportunity</Link>
      <article className={styles.card} aria-label="Application">
        <header className={styles.brandHeader}><BrandLockup /><span>APPLICATION FORM</span></header>
        {result ? <div className={styles.success}>
          <CheckCircle2 size={48} aria-hidden="true" />
          <h1 ref={headingRef} tabIndex={-1}>Application received</h1>
          <p>Your application for <strong>{result.jobTitle}</strong> has been received.</p>
          <div className={styles.reference}><span>Your application reference</span><strong>{result.reference}</strong>
            <button type="button" onClick={async () => {
              try { await navigator.clipboard.writeText(result.reference); setCopyNotice("Reference copied."); }
              catch { setCopyNotice("Select and copy your reference above to save it."); }
            }}>Copy reference <FileText size={16} /></button>
            {copyNotice && <span role="status">{copyNotice}</span>}
          </div>
          <p>Save this reference. The recruitment team can use it to locate your application and contact you about the next steps.</p>
          <Link href="/jobs" className="button button-primary">Explore opportunities <ArrowRight size={17} /></Link>
        </div> : <form ref={formRef} className={styles.form} aria-label="Job application form" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <div className={styles.intro}><h1 ref={headingRef} tabIndex={-1}>Welcome! Please tell us about yourself.</h1><p>Please enter these details as they appear on your passport.</p><span className={styles.rule} /></div>
          <p className={styles.requiredNote}><span>*</span> Required information</p>
          {errorCount > 0 && <p className={styles.errorSummary} role="alert">Please check the highlighted answers and attachments before submitting.</p>}
          <div className={styles.honeypot} aria-hidden="true"><label htmlFor="website">Website</label><input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></div>
          <section className={styles.grid} aria-label="Personal details">
            {textField("firstName", "Your first name", { autoComplete: "given-name", placeholder: "Enter your first name" })}
            {textField("lastName", "Your last name", { autoComplete: "family-name", placeholder: "Enter your last name" })}
            {choice("gender", "Enter your gender", ["Male", "Female"])}
            <div className={styles.field}><label htmlFor="email">Email<span className={styles.asterisk}>*</span></label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} value={values.email} disabled={busy} aria-required="true" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} onChange={(event) => update("email", event.target.value)} />{errors.email && <p id="email-error" className={styles.fieldError}>{errors.email}</p>}</div>
            <div className={styles.field}><label htmlFor="phone"><Image src="/brand/messaging/whatsapp.svg" width={20} height={20} alt="" aria-hidden="true" unoptimized className={styles.contactBrandIcon} />WhatsApp number<span className={styles.asterisk}>*</span></label><input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+63 912 345 6789" maxLength={30} value={values.phone} disabled={busy} aria-required="true" aria-invalid={Boolean(errors.phone)} aria-describedby={`phone-help${errors.phone ? " phone-error" : ""}`} onChange={(event) => update("phone", event.target.value)} /><p id="phone-help" className={styles.help}>Enter your active WhatsApp number with the country code.</p>{errors.phone && <p id="phone-error" className={styles.fieldError}>{errors.phone}</p>}</div>
            {textField("telegram", "Telegram number", { optional: true, type: "tel", placeholder: "Enter your Telegram number", help: "Enter your active Telegram number, if you use Telegram.", icon: <Image src="/brand/messaging/telegram.svg" width={20} height={20} alt="" aria-hidden="true" unoptimized className={styles.contactBrandIcon} /> })}
            <fieldset className={`${styles.addressGroup} ${styles.full}`}>
              <legend>Your current address / location</legend>
              <div className={styles.grid}>
                {textField("street", "Street", { autoComplete: "street-address", placeholder: "House / building number and street" })}
                {textField("city", "City", { autoComplete: "address-level2", placeholder: "Enter your city" })}
                {textField("province", "Province", { autoComplete: "address-level1", placeholder: "Enter your province / state" })}
                {textField("postalCode", "Postal code", { autoComplete: "postal-code", placeholder: "Enter your postal code" })}
              </div>
            </fieldset>
            {textField("dateOfBirth", "Date of birth", { type: "date", autoComplete: "bday" })}
            {textField("placeOfBirth", "Your place of birth", { placeholder: "City / province and country" })}
            {textField("fatherName", "Your father’s full name", { optional: true })}
            {textField("motherName", "Your mother’s full name", { optional: true })}
            {profileSelect("destinationCountry", "Please select a country where you would like to apply", destinationCountries, true, "Select your preferred country for your application.")}
          </section>
          <section className={styles.section} aria-labelledby="work-heading">
            <h2 id="work-heading">Work Experience</h2><span className={styles.rule} />
            <div className={styles.grid}>
              {profileSelect("currentWorkCountry", "Country where you are currently working", countryOptions, true, "Select the country where you currently work or are based.")}
              <div className={`${styles.field} ${styles.full}`}><label htmlFor="jobId">What job position are you primarily applying for?<span className={styles.asterisk}>*</span></label><select id="jobId" name="jobId" value={values.jobId} disabled={busy} aria-required="true" aria-invalid={Boolean(errors.jobId)} aria-describedby={`job-help${errors.jobId ? " jobId-error" : ""}`} onChange={(event) => update("jobId", event.target.value)}><optgroup label="Official listed jobs">{jobs.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}</optgroup>{additionalJobs.length > 0 && <optgroup label="Other jobs we’re offering">{additionalJobs.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}</optgroup>}</select><p id="job-help" className={styles.help}>Please select only a position for which you already have relevant work experience.</p>{errors.jobId && <p id="jobId-error" className={styles.fieldError}>{errors.jobId}</p>}</div>
              {profileSelect("secondaryJobTitle", "Please select an additional role in which you have experience, other than the position you are applying for", secondaryJobPositions.filter((title) => title.toLowerCase() !== selectedJob.title.toLowerCase()), true, "Select another role that matches your experience, or choose ‘No other position’.")}
              {textField("otherJobTitle", "If the job you’re applying for is not listed above, please enter it here", { optional: true, wide: true })}
            </div>
          </section>
          <section className={styles.section} aria-labelledby="referral-heading">
            <h2 id="referral-heading">How you found us</h2><span className={styles.rule} />
            <div className={styles.field}>
              <label htmlFor="referralSource">Where did you find us?<span className={styles.asterisk}>*</span></label>
              <select id="referralSource" name="referralSource" value={values.referralSource || ""} required disabled={busy}
                aria-required="true" aria-invalid={Boolean(errors.referralSource)} aria-describedby={errors.referralSource ? "referralSource-error" : undefined}
                onChange={(event) => update("referralSource", event.target.value)}>
                <option value="">Select where you found us</option>
                {referralSources.map((source) => <option key={source} value={source}>{source}</option>)}
              </select>
              {errors.referralSource && <p id="referralSource-error" className={styles.fieldError}>{errors.referralSource}</p>}
            </div>
          </section>
          <section className={styles.section} aria-labelledby="requirements-heading">
            <h2 id="requirements-heading">Documents may be required</h2><span className={styles.rule} />
            <p className={styles.sectionIntro}>Depending on your position and destination country, the following documents may be required:</p>
            <ul className={styles.documentList}>{fairDocuments.map((document) => <li key={document}>{document === "Form 18a" ? "Form 18a (for Croatia applicants)" : document}</li>)}</ul>
            <p className={styles.sectionIntro}>A valid Philippine driver’s license (front &amp; back) is required for driver applicants.</p>
            <div className={styles.timingNotice}><strong>IMPORTANT</strong><p>{fairDocumentTiming}</p></div>
            <table className={styles.requirementsTable}>
              <caption>NC2 certificate required by position</caption>
              <thead><tr><th scope="col">Position</th><th scope="col">Required NC2</th></tr></thead>
              <tbody>{fairNc2Requirements.map(({ position, certificate }) => <tr key={position}><th scope="row">{position}</th><td>{certificate}</td></tr>)}</tbody>
            </table>
            <p className={styles.electricalNote}>* {nc2ElectricalNote}</p>
          </section>
          <section className={styles.section} aria-labelledby="documents-heading">
            <h2 id="documents-heading">Document Uploads</h2><span className={styles.rule} />
            <p className={styles.sectionIntro}>For this application, attach your CV / Resume, valid passport, and residence ID.{driverApplicant ? " Driver applicants must also attach a valid Philippine driver’s license (front & back)." : ""} Attach the work permit documents below if you have them available.</p>
            <div className={styles.checklist}><ClipboardCheck size={22} aria-hidden="true" /><div><strong role="status">{readyCount} of {requiredAttachments.length} required documents ready</strong><p>{(totalUploadBytes / 1024 / 1024).toFixed(1)} MB of {MAX_PROFILE_UPLOAD_BYTES / 1024 / 1024} MB used. Maximum {MAX_SUPPORTING_DOCUMENT_BYTES / 1024 / 1024} MB per file and {MAX_PROFILE_UPLOAD_BYTES / 1024 / 1024} MB combined.</p></div></div>
            <div className={styles.uploads}>
              <AttachmentUpload id="resume" label="Please upload your CV / Resume" required hint="Maximum one file. Please make sure your CV / Resume is updated." accept=".pdf,.doc,.docx" maxBytes={MAX_PROFILE_RESUME_BYTES} file={resume} error={errors.resume} disabled={busy} onChange={chooseResume} />
              {upload("passport")}{upload("residence-id")}{upload("diploma")}{upload("nc2")}{upload("nbi")}{upload("form18a")}{upload("employment-certificate")}{upload("driver-license")}
            </div>
            {errors.documents && <p className={styles.errorSummary} role="alert" data-form-error tabIndex={-1}>{errors.documents}</p>}
            <p className={styles.privacyHint}><LockKeyhole size={16} aria-hidden="true" />Your files are private and available only to authorized recruitment staff.</p>
          </section>
          <section className={styles.section} aria-labelledby="notices-heading">
            <h2 id="notices-heading">IMPORTANT NOTICES</h2><span className={styles.rule} />
            {choice("englishProficiency", "We require all candidates to display basic proficiency in English. Are you able to speak, read, and write English at a basic level?", ["Yes", "No"], true)}
            <p className={styles.feeNotice}><CheckCircle2 size={20} aria-hidden="true" /><strong>No placement fee.</strong></p>
          </section>
          <section className={styles.section} aria-labelledby="terms-heading">
            <h2 id="terms-heading">Terms and Conditions</h2><span className={styles.rule} />
            <label className={styles.consent}><input id="profile.termsAccepted" type="checkbox" checked={values.profile?.termsAccepted || false} disabled={busy} aria-required="true" aria-invalid={Boolean(errors["profile.termsAccepted"])} aria-describedby={errors["profile.termsAccepted"] ? "terms-error" : undefined} onChange={(event) => updateProfile("termsAccepted", event.target.checked)} /><span>I agree to the <Link href="/terms" target="_blank" rel="noopener noreferrer">terms and conditions</Link> provided by Jobs in Croatia. By providing my contact details, I agree to receive messages about my application.</span></label>
            {errors["profile.termsAccepted"] && <p id="terms-error" className={styles.fieldError}>{errors["profile.termsAccepted"]}</p>}
            <label className={styles.consent}><input id="consent" type="checkbox" checked={values.consent} disabled={busy} aria-required="true" aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? "consent-error" : undefined} onChange={(event) => update("consent", event.target.checked)} /><span>I agree to the <Link href="/privacy" target="_blank" rel="noopener noreferrer">privacy policy</Link> provided by Jobs in Croatia and understand that my information will be used in accordance with the policy.</span></label>
            {errors.consent && <p id="consent-error" className={styles.fieldError}>{errors.consent}</p>}
          </section>
          {error && <p className={styles.errorSummary} role="alert">{error}</p>}
          {busy && <div className={styles.progress} role="status"><p>{progress < 100 ? "Uploading your application" : "Confirming receipt…"}<span>{progress}%</span></p><progress value={progress} max={100} aria-label="Application upload progress" /></div>}
          <button className={styles.submit} type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit"}<ArrowRight size={18} aria-hidden="true" /></button>
          <p className={styles.saveNote}>Check your answers before submitting. Your application is sent only when you select Submit.</p>
          <div className={styles.policyLinks}><Link href="/privacy">Privacy Policy</Link><span>|</span><Link href="/terms">Terms of Service</Link></div>
        </form>}
      </article>
    </div>
  </div>;
}
