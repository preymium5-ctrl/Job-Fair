"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, LockKeyhole } from "lucide-react";
import type { Job } from "@/lib/types";
import { fieldErrors } from "@/lib/validation";
import { referralSources } from "@/lib/referral-sources";
import { prepareApplicationUpload, stageApplicationUpload, resetStagedUpload, type PreparedApplicationUpload } from "@/lib/application-upload-client";
import { MAX_APPLICATION_UPLOAD_BYTES, MAX_PROFILE_RESUME_BYTES, MAX_SUPPORTING_DOCUMENT_BYTES } from "@/lib/document-uploads";
import {
  DRIVER_FORM_VERSION, MAX_IDP_FILES, driverApplicationSchema, holdsCzechTruckCategories, meetsCzechRequirement,
  philippineLicenseCategories, requiredDriverDocumentFields, type DriverFormVariant, type PhilippineLicenseCategory,
} from "@/lib/driver-applications";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { applicationDestinationCountries, countryOptions } from "@/data/application-form-options";
import { BrandLockup } from "@/components/ui/Brand";
import AttachmentUpload from "./AttachmentUpload";
import styles from "./ApplicationForm.module.css";

type FormErrors = Record<string, string | undefined>;
type JobOption = Pick<Job, "id" | "title" | "slug">;
type Answers = {
  jobId: string; firstName: string; lastName: string; email: string; phone: string; telegram: string;
  dateOfBirth: string; currentCountry: string; currentLocation: string; destinationCountry: string;
  licenseCategories: PhilippineLicenseCategory[]; licenseExpiry: string; drivingExperienceYears: string;
  hasIdp: "" | "Yes" | "No"; idpExpiry: string; shareWithTendaDom: boolean; englishProficiency: "" | "Yes" | "No";
  referralSource: string; termsAccepted: boolean; consent: boolean;
};
const PHOTO_SELECTION_BYTES = 25 * 1024 * 1024;
const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png";
const idpFields = Array.from({ length: MAX_IDP_FILES }, (_, index) => `document:idp-${index + 1}`);

export default function DriverApplicationForm({ variant, jobs, defaultJobId = "" }: { variant: DriverFormVariant; jobs: JobOption[]; defaultJobId?: string }) {
  const czech = variant === "czech-licence-check";
  const [values, setValues] = useState<Answers>({
    jobId: jobs.some(({ id }) => id === defaultJobId) ? defaultJobId : jobs.length === 1 ? jobs[0].id : "",
    firstName: "", lastName: "", email: "", phone: "", telegram: "", dateOfBirth: "", currentCountry: "", currentLocation: "",
    destinationCountry: czech ? "Czech Republic" : "", licenseCategories: [], licenseExpiry: "", drivingExperienceYears: "",
    hasIdp: czech ? "Yes" : "", idpExpiry: "", shareWithTendaDom: false, englishProficiency: "", referralSource: "",
    termsAccepted: false, consent: false,
  });
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [applicationCheck, setApplicationCheck] = useState("");
  const [result, setResult] = useState<{ reference: string; jobTitle: string } | null>(null);
  const [copyNotice, setCopyNotice] = useState("");
  const [todayIso] = useState(() => new Date().toISOString().slice(0, 10));
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submittingRef = useRef(false);
  const idempotencyRef = useRef<string | null>(null);
  const preparedUploadRef = useRef<PreparedApplicationUpload | null>(null);

  const qualifies = meetsCzechRequirement(values);
  const showTendaDom = czech || qualifies;
  const requiredFields = requiredDriverDocumentFields({ variant, shareWithTendaDom: values.shareWithTendaDom, hasIdp: values.hasIdp });
  const idpCount = idpFields.filter((field) => files[field]).length;
  const totalUploadBytes = Object.values(files).reduce((sum, file) => sum + (file?.size || 0), 0);

  function invalidateSubmission() { idempotencyRef.current = null; preparedUploadRef.current = null; }
  function update<K extends keyof Answers>(key: K, value: Answers[K]) {
    invalidateSubmission();
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "hasIdp" && value !== "Yes") next.idpExpiry = "";
      if (!czech && !meetsCzechRequirement(next)) next.shareWithTendaDom = false;
      return next;
    });
    setErrors((current) => ({ ...current, [key]: undefined, ...(key === "hasIdp" ? { idpExpiry: undefined, "document:idp-1": undefined } : {}) }));
  }
  function toggleCategory(category: PhilippineLicenseCategory, checked: boolean) {
    update("licenseCategories", checked ? [...values.licenseCategories, category] : values.licenseCategories.filter((item) => item !== category));
  }
  function fileError(field: string, file: File) {
    const isResume = field === "resume";
    const max = isResume ? MAX_PROFILE_RESUME_BYTES : MAX_SUPPORTING_DOCUMENT_BYTES;
    if (!(isResume ? /\.(pdf|doc|docx)$/i : /\.(pdf|jpe?g|png)$/i).test(file.name))
      return isResume ? "Choose a PDF, DOC, or DOCX file." : "Choose a PDF, JPG, or PNG file.";
    if (!file.size || file.size > max)
      return /\.pdf$/i.test(file.name) && !isResume ? "This PDF is larger than 5 MB. Upload photos instead, or a smaller PDF." : `Choose a non-empty file of ${max / 1024 / 1024} MB or less.`;
  }
  async function chooseFile(field: string, file: File | null) {
    invalidateSubmission();
    const prepared = file && field !== "resume" ? await shrinkPhoto(file) : file;
    setFiles((current) => {
      const next = { ...current, [field]: prepared || undefined };
      // Keep IDP pages contiguous so the tracker lists every page in order.
      if (!prepared && field.startsWith("document:idp-")) {
        const remaining = idpFields.map((item) => next[item]).filter(Boolean) as File[];
        idpFields.forEach((item, index) => { next[item] = remaining[index]; });
      }
      return next;
    });
    setErrors((current) => ({ ...current, [field]: prepared ? fileError(field, prepared) : undefined, documents: undefined, ...(field.startsWith("document:idp-") ? Object.fromEntries(idpFields.map((item) => [item, undefined])) : {}) }));
  }
  function payload() {
    const years = values.drivingExperienceYears.trim() === "" ? undefined : Number(values.drivingExperienceYears);
    return {
      form: DRIVER_FORM_VERSION, variant, jobId: values.jobId, firstName: values.firstName, lastName: values.lastName,
      email: values.email, phone: values.phone, telegram: values.telegram, dateOfBirth: values.dateOfBirth,
      currentCountry: values.currentCountry, currentLocation: values.currentLocation, destinationCountry: values.destinationCountry,
      licenseCategories: values.licenseCategories, licenseExpiry: values.licenseExpiry, drivingExperienceYears: years,
      hasIdp: values.hasIdp || undefined, idpExpiry: values.hasIdp === "Yes" ? values.idpExpiry : "",
      shareWithTendaDom: values.shareWithTendaDom, englishProficiency: values.englishProficiency || undefined,
      referralSource: values.referralSource, termsAccepted: values.termsAccepted, consent: values.consent,
    };
  }
  function validateFiles() {
    const next: FormErrors = {};
    for (const field of requiredFields) if (!files[field]) next[field] = field === "document:idp-1" ? "Attach your International Driving Permit pages." : "Attach this side of your licence.";
    for (const [field, file] of Object.entries(files)) if (file && fileError(field, file)) next[field] = fileError(field, file);
    if (totalUploadBytes > MAX_APPLICATION_UPLOAD_BYTES) next.documents = "Keep all files together within 15 MB. Remove a file or upload smaller photos.";
    return next;
  }
  function showErrors(next: FormErrors) {
    setErrors(next);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true'], [data-form-error]")?.focus());
  }
  async function submit() {
    if (submittingRef.current) return;
    const parsed = driverApplicationSchema.safeParse(payload());
    // Cross-field rules run only once every basic answer parses, so list them up front too.
    const crossField: FormErrors = {
      dateOfBirth: values.dateOfBirth ? undefined : "Enter your date of birth.",
      licenseExpiry: values.licenseExpiry ? undefined : "Enter the expiry date on your licence.",
      idpExpiry: values.hasIdp === "Yes" && !values.idpExpiry ? "Enter the expiry date shown on your IDP." : undefined,
      licenseCategories: czech && values.licenseCategories.length && !holdsCzechTruckCategories(values.licenseCategories) ? "This check is for drivers whose Philippine licence includes both C and CE." : undefined,
      shareWithTendaDom: czech && !values.shareWithTendaDom ? "Agree to share your documents with Tenda Dom to continue." : undefined,
    };
    const parsedErrors: FormErrors = !parsed.success ? fieldErrors(parsed.error) : {};
    const next: FormErrors = { ...parsedErrors, ...validateFiles() };
    for (const [key, message] of Object.entries(crossField)) if (message && !parsed.success) next[key] = message;
    if (Object.values(next).some(Boolean) || !parsed.success) { showErrors(next); return; }
    submittingRef.current = true;
    setBusy(true); setError(""); setProgress(0);
    idempotencyRef.current ||= crypto.randomUUID();
    const body = new FormData();
    body.append("payload", JSON.stringify(parsed.data));
    for (const [field, file] of Object.entries(files)) if (file) body.append(field, file);
    body.append("applicationCheck", applicationCheck);
    body.append("idempotencyKey", idempotencyRef.current);
    const fail = (message: string) => { setError(message); setBusy(false); submittingRef.current = false; };
    let transmission: Awaited<ReturnType<typeof stageApplicationUpload>>;
    try {
      if (preparedUploadRef.current?.key !== idempotencyRef.current)
        preparedUploadRef.current = await prepareApplicationUpload(body, idempotencyRef.current);
      transmission = await stageApplicationUpload(preparedUploadRef.current, setProgress);
    } catch (problem) {
      fail(problem instanceof Error ? problem.message : "We couldn’t upload your files. Select Submit to retry.");
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/driver-applications");
    xhr.timeout = 300000;
    if (transmission.contentType) xhr.setRequestHeader("Content-Type", transmission.contentType);
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round((transmission.staged ? 90 : 0) + (event.loaded / event.total) * (transmission.staged ? 10 : 100))); };
    xhr.onerror = () => fail("We couldn’t connect. Your application has not been confirmed. Check your connection and try again.");
    xhr.ontimeout = () => fail("The request timed out. Try again; your reference will be recovered if the application was received.");
    xhr.onload = () => {
      if (xhr.status === 413) { showErrors({ documents: "Choose smaller files, with all files together within 15 MB." }); fail("We couldn’t transfer the files. Check their sizes and select Submit to retry."); return; }
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

  function describedBy(id: string, help?: boolean) {
    return [help ? `${id}-help` : "", errors[id] ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  }
  function errorText(id: string) { return errors[id] ? <p className={styles.fieldError} id={`${id}-error`}>{errors[id]}</p> : null; }
  function input(key: "firstName" | "lastName" | "email" | "phone" | "telegram" | "dateOfBirth" | "currentLocation" | "licenseExpiry" | "idpExpiry" | "drivingExperienceYears", label: string,
    options: { type?: string; optional?: boolean; wide?: boolean; help?: string; placeholder?: string; autoComplete?: string; max?: number; min?: string; maxDate?: string; icon?: ReactNode } = {}) {
    return <div className={`${styles.field} ${options.wide ? styles.full : ""}`}>
      <label htmlFor={key}>{options.icon}{label}{options.optional ? <span className={styles.optional}>Optional</span> : <span className={styles.asterisk}>*</span>}</label>
      <input id={key} name={key} type={options.type || "text"} value={values[key]} maxLength={options.max} placeholder={options.placeholder}
        autoComplete={options.autoComplete} min={options.min} max={options.maxDate} inputMode={key === "drivingExperienceYears" ? "numeric" : undefined}
        disabled={busy} aria-required={!options.optional} aria-invalid={Boolean(errors[key])} aria-describedby={describedBy(key, Boolean(options.help))}
        onChange={(event) => update(key, event.target.value)} />
      {options.help && <p className={styles.help} id={`${key}-help`}>{options.help}</p>}
      {errorText(key)}
    </div>;
  }
  function select(key: "jobId" | "currentCountry" | "destinationCountry" | "referralSource", label: string, options: readonly { value: string; label: string }[], help?: string, placeholder = "Select an option") {
    return <div className={`${styles.field} ${styles.full}`}>
      <label htmlFor={key}>{label}<span className={styles.asterisk}>*</span></label>
      <select id={key} name={key} value={values[key]} disabled={busy} aria-required="true" aria-invalid={Boolean(errors[key])} aria-describedby={describedBy(key, Boolean(help))}
        onChange={(event) => update(key, event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {help && <p className={styles.help} id={`${key}-help`}>{help}</p>}
      {errorText(key)}
    </div>;
  }
  function yesNo(key: "hasIdp" | "englishProficiency", label: string, wide = true) {
    return <fieldset className={`${styles.choiceField} ${wide ? styles.full : ""}`} tabIndex={-1} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined}>
      <legend>{label}<span className={styles.asterisk}>*</span></legend>
      <div className={styles.choices}>{(["Yes", "No"] as const).map((option) => <label key={option}><input type="radio" name={key} value={option} checked={values[key] === option} disabled={busy} onChange={() => update(key, option)} /><span>{option}</span></label>)}</div>
      {errorText(key)}
    </fieldset>;
  }
  function upload(field: string, label: string, required: boolean, hint: string, resume = false) {
    return <AttachmentUpload key={field} id={field.replace(":", "-")} label={label} required={required} hint={hint}
      accept={resume ? ".pdf,.doc,.docx" : DOCUMENT_ACCEPT} maxBytes={resume ? MAX_PROFILE_RESUME_BYTES : PHOTO_SELECTION_BYTES}
      file={files[field] || null} error={errors[field]} disabled={busy} onChange={(file) => { void chooseFile(field, file); }} />;
  }

  const visibleIdpSlots = Math.min(MAX_IDP_FILES, idpCount + 1);
  const idpRequired = requiredFields.includes("document:idp-1");
  const errorCount = Object.values(errors).filter(Boolean).length;

  return <div className={styles.page}>
    <div className={styles.shell}>
      <Link href={czech ? "/apply/drivers" : "/jobs"} className={styles.back}><ArrowLeft size={16} /> {czech ? "Driver application form" : "Back to opportunities"}</Link>
      <article className={styles.card} aria-label="Driver application">
        <header className={styles.brandHeader}><BrandLockup /><span>{czech ? "CZECH LICENCE CHECK" : "DRIVER APPLICATION"}</span></header>
        {result ? <div className={styles.success}>
          <CheckCircle2 size={48} aria-hidden="true" />
          <h1 ref={headingRef} tabIndex={-1}>{czech ? "Documents received" : "Application received"}</h1>
          <p>Your {czech ? "documents and details" : "application"} for <strong>{result.jobTitle}</strong> {czech ? "have" : "has"} been received.</p>
          <div className={styles.reference}><span>Your reference</span><strong>{result.reference}</strong>
            <button type="button" onClick={async () => {
              try { await navigator.clipboard.writeText(result.reference); setCopyNotice("Reference copied."); }
              catch { setCopyNotice("Select and copy your reference above to save it."); }
            }}>Copy reference <FileText size={16} /></button>
            {copyNotice && <span role="status">{copyNotice}</span>}
          </div>
          <p>{czech ? "We will contact you once Tenda Dom has checked with the Czech authorities." : "Save this reference. The recruitment team will contact you about the next steps."}</p>
          <Link href="/jobs" className="button button-primary">Explore opportunities <ArrowRight size={17} /></Link>
        </div> : <form ref={formRef} className={styles.form} aria-label={czech ? "Czech licence check form" : "Driver application form"} noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <div className={styles.intro}>
            <h1 ref={headingRef} tabIndex={-1}>{czech ? "Czech Republic licence check for C and CE drivers" : "Driver application form"}</h1>
            {czech ? <>
              <p>Our employer partner in the Czech Republic, Tenda Dom, wants to confirm with the Czech authorities whether a driver with a valid Philippine driver’s licence showing categories C and CE, together with an International Driving Permit (IDP) issued in the Philippines, is allowed to drive a truck in the Czech Republic.</p>
              <p>If you hold both and are willing to help, please send:</p>
              <ul className={styles.documentList}>
                <li>A photo or scan of the front and back of your Philippine driver’s licence.</li>
                <li>Photos or scans of all pages of your International Driving Permit.</li>
              </ul>
              <p>Your documents are shared with Tenda Dom only for this verification, and only if you agree below.</p>
            </> : <>
              <p>This form is only for professional drivers, such as trailer, truck, bus, van and delivery drivers. Please enter your details as they appear on your passport and driver’s licence.</p>
              <p>Do you have categories C and CE on your Philippine licence and an International Driving Permit? Fill in the IDP questions below. You can also send your documents through the <Link href="/apply/drivers/czech-licence-check">Czech Republic licence check</Link>.</p>
            </>}
            <span className={styles.rule} />
          </div>
          <p className={styles.requiredNote}><span>*</span> Required information</p>
          {errorCount > 0 && <p className={styles.errorSummary} role="alert">Please check the highlighted answers and attachments before submitting.</p>}
          <div hidden inert aria-hidden="true"><label htmlFor="application-check">Leave this blank</label><input id="application-check" name="applicationCheck" tabIndex={-1} autoComplete="off" value={applicationCheck} onChange={(event) => { preparedUploadRef.current = null; setApplicationCheck(event.target.value); }} /></div>

          <section className={styles.grid} aria-label="Personal details">
            {input("firstName", "Your first name", { autoComplete: "given-name", max: 60, placeholder: "Enter your first name" })}
            {input("lastName", "Your last name", { autoComplete: "family-name", max: 60, placeholder: "Enter your last name" })}
            {input("email", "Email", { type: "email", autoComplete: "email", max: 254, placeholder: "you@example.com" })}
            {input("phone", "WhatsApp number", { type: "tel", autoComplete: "tel", max: 30, placeholder: "+63 912 345 6789", help: "Enter your active WhatsApp number with the country code.",
              icon: <Image src="/brand/messaging/whatsapp.svg" width={20} height={20} alt="" aria-hidden="true" unoptimized className={styles.contactBrandIcon} /> })}
            {input("telegram", "Telegram number", { type: "tel", optional: true, max: 80, placeholder: "Enter your Telegram number",
              icon: <Image src="/brand/messaging/telegram.svg" width={20} height={20} alt="" aria-hidden="true" unoptimized className={styles.contactBrandIcon} /> })}
            {input("dateOfBirth", "Date of birth", { type: "date", autoComplete: "bday", maxDate: todayIso })}
            {select("currentCountry", "Country where you are currently based", countryOptions.map((value) => ({ value, label: value })))}
            {input("currentLocation", "Current city and province", { wide: true, max: 140, placeholder: "e.g. Quezon City, Metro Manila", autoComplete: "address-level2" })}
          </section>

          <section className={styles.section} aria-labelledby="driving-heading">
            <h2 id="driving-heading">Driving licence and experience</h2><span className={styles.rule} />
            <div className={styles.grid}>
              {select("jobId", "Which driver position are you applying for?", jobs.map(({ id, title }) => ({ value: id, label: title })), "Select the driving role that matches your experience.", "Select a driver position")}
              {select("destinationCountry", "Which country would you like to work in?", applicationDestinationCountries.map((value) => ({ value, label: value })))}
              <fieldset className={`${styles.choiceField} ${styles.full}`} tabIndex={-1} aria-invalid={Boolean(errors.licenseCategories)} aria-describedby={`licenseCategories-help${errors.licenseCategories ? " licenseCategories-error" : ""}`}>
                <legend>Which categories are on your Philippine driver’s licence?<span className={styles.asterisk}>*</span></legend>
                <div className={styles.choices}>{philippineLicenseCategories.map((category) => <label key={category}><input type="checkbox" name="licenseCategories" value={category} checked={values.licenseCategories.includes(category)} disabled={busy} onChange={(event) => toggleCategory(category, event.target.checked)} /><span>{category}</span></label>)}</div>
                <p className={styles.help} id="licenseCategories-help">Select every category printed on your licence. Trucks need C; trucks with trailers need CE.{czech ? " This check needs both C and CE." : ""}</p>
                {errorText("licenseCategories")}
              </fieldset>
              {input("licenseExpiry", "Licence expiry date", { type: "date", min: todayIso })}
              {input("drivingExperienceYears", "Years of professional driving experience", { type: "number", max: 2, placeholder: "e.g. 6" })}
              {yesNo("hasIdp", "Do you have an International Driving Permit (IDP) issued in the Philippines?")}
              {values.hasIdp === "Yes" && input("idpExpiry", "IDP expiry date", { type: "date", min: todayIso })}
            </div>
            {!czech && values.licenseCategories.length > 0 && <div className={styles.timingNotice}>
              <strong>{qualifies ? "YOU MEET THE CZECH REQUIREMENT" : "CZECH REPUBLIC TRUCK REQUIREMENT"}</strong>
              <p>{qualifies ? "You hold C, CE and an IDP. Please upload your IDP pages below and, if you agree, allow us to share them with Tenda Dom for verification." : holdsCzechTruckCategories(values.licenseCategories) ? "You hold C and CE. For truck roles in the Czech Republic, an International Driving Permit issued in the Philippines is also being checked." : "Truck roles in the Czech Republic are being checked for drivers holding C and CE, together with an International Driving Permit."}</p>
            </div>}
          </section>

          <section className={styles.section} aria-labelledby="documents-heading">
            <h2 id="documents-heading">Document uploads</h2><span className={styles.rule} />
            <p className={styles.sectionIntro}>Upload clear photos or scans in which every word is readable. Large photos are resized automatically. PDFs must be 5 MB or smaller, and all files together must be within 15 MB.</p>
            <div className={styles.uploads}>
              {upload("document:license-front", "Philippine driver’s licence — front", true, "A photo or scan of the front of your valid licence, showing your categories.")}
              {upload("document:license-back", "Philippine driver’s licence — back", true, "A photo or scan of the back of your licence, including restriction codes and conditions.")}
              {Array.from({ length: visibleIdpSlots }, (_, index) => upload(idpFields[index],
                index === 0 ? "Please upload photos or scans of all pages of your International Driving Permit (IDP)" : `More pages of your International Driving Permit (file ${index + 1} of up to ${MAX_IDP_FILES})`,
                index === 0 && idpRequired,
                index === 0 ? `Photos or scans of all pages of your International Driving Permit. Upload one PDF with every page, or one photo per page (two facing pages per photo is fine). Another upload box appears after each file, up to ${MAX_IDP_FILES} files.${idpRequired ? "" : " Optional if you do not have an IDP."}` : "Photos or scans of the remaining pages of your International Driving Permit, if any."))}
              {upload("resume", "CV / Resume", false, "Optional. Attach your updated CV if you have one.", true)}
            </div>
            <p className={styles.help} role="status">{idpCount} IDP file{idpCount === 1 ? "" : "s"} attached · {(totalUploadBytes / 1024 / 1024).toFixed(1)} MB of 15 MB used.</p>
            {errors.documents && <p className={styles.errorSummary} role="alert" data-form-error tabIndex={-1}>{errors.documents}</p>}
            <p className={styles.privacyHint}><LockKeyhole size={16} aria-hidden="true" />Your files are private and available only to authorized recruitment staff{showTendaDom ? " and, with your consent, Tenda Dom" : ""}.</p>
          </section>

          {showTendaDom && <section className={styles.section} aria-labelledby="tenda-dom-heading">
            <h2 id="tenda-dom-heading">Consent to share with Tenda Dom</h2><span className={styles.rule} />
            <label className={styles.consent}><input id="shareWithTendaDom" type="checkbox" checked={values.shareWithTendaDom} disabled={busy} aria-required={czech} aria-invalid={Boolean(errors.shareWithTendaDom)} aria-describedby={errors.shareWithTendaDom ? "shareWithTendaDom-error" : undefined} onChange={(event) => update("shareWithTendaDom", event.target.checked)} />
              <span>I agree that Jobs in Croatia may share my Philippine driver’s licence and International Driving Permit with Tenda Dom, so that Tenda Dom can verify with the relevant Czech authorities whether I am allowed to drive a truck in the Czech Republic.{czech ? "" : " (Optional)"}</span></label>
            {errorText("shareWithTendaDom")}
          </section>}

          <section className={styles.section} aria-labelledby="about-heading">
            <h2 id="about-heading">A few more questions</h2><span className={styles.rule} />
            <div className={styles.grid}>
              {yesNo("englishProficiency", "Are you able to speak, read, and write English at a basic level?")}
              {select("referralSource", "Where did you find us?", referralSources.map((value) => ({ value, label: value })), undefined, "Select where you found us")}
            </div>
            <p className={styles.feeNotice}><CheckCircle2 size={20} aria-hidden="true" /><strong>No placement fee.</strong></p>
          </section>

          <section className={styles.section} aria-labelledby="terms-heading">
            <h2 id="terms-heading">Terms and Conditions</h2><span className={styles.rule} />
            <label className={styles.consent}><input id="termsAccepted" type="checkbox" checked={values.termsAccepted} disabled={busy} aria-required="true" aria-invalid={Boolean(errors.termsAccepted)} aria-describedby={errors.termsAccepted ? "termsAccepted-error" : undefined} onChange={(event) => update("termsAccepted", event.target.checked)} /><span>I agree to the <Link href="/terms" target="_blank" rel="noopener noreferrer">terms and conditions</Link> provided by Jobs in Croatia. By providing my contact details, I agree to receive messages about my application.</span></label>
            {errorText("termsAccepted")}
            <label className={styles.consent}><input id="consent" type="checkbox" checked={values.consent} disabled={busy} aria-required="true" aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? "consent-error" : undefined} onChange={(event) => update("consent", event.target.checked)} /><span>I agree to the <Link href="/privacy" target="_blank" rel="noopener noreferrer">privacy policy</Link> provided by Jobs in Croatia and understand that my information will be used in accordance with the policy.</span></label>
            {errorText("consent")}
          </section>
          {error && <p className={styles.errorSummary} role="alert">{error}</p>}
          {busy && <div className={styles.progress} role="status"><p>{progress < 100 ? "Uploading your documents" : "Confirming receipt…"}<span>{progress}%</span></p><progress value={progress} max={100} aria-label="Upload progress" /></div>}
          <button className={styles.submit} type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit"}<ArrowRight size={18} aria-hidden="true" /></button>
          <p className={styles.saveNote}>Check your answers before submitting. Your {czech ? "documents are" : "application is"} sent only when you select Submit.</p>
          <div className={styles.policyLinks}><Link href="/privacy">Privacy Policy</Link><span>|</span><Link href="/terms">Terms of Service</Link></div>
        </form>}
      </article>
    </div>
  </div>;
}
