"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, LockKeyhole } from "lucide-react";
import type { Job } from "@/lib/types";
import { fieldErrors } from "@/lib/validation";
import { MAX_VIDEO_BYTES, MIN_VIDEO_SECONDS, VIDEO_ACCEPT, VIDEO_FORM_VERSION, videoApplicationSchema, videoMime } from "@/lib/video-applications";
import { readVideoDuration, uploadVideoToDrive, VideoUploadError } from "@/lib/video-upload-client";
import { BrandLockup } from "@/components/ui/Brand";
import AttachmentUpload from "./AttachmentUpload";
import styles from "./ApplicationForm.module.css";

type FormErrors = Record<string, string | undefined>;
type JobOption = Pick<Job, "id" | "title">;
type Answers = {
  fullName: string; age: string; nationality: string; jobId: string; experienceYears: string;
  phone: string; telegram: string; termsAccepted: boolean; consent: boolean;
};
/** The video upload survives answer edits, so a retry never sends 100 MB twice. */
type UploadState = { file: File; uploadId: string; uploadUrl: string; started: boolean; fileId?: string };

const VIDEO_MB = MAX_VIDEO_BYTES / 1024 / 1024;

function minutes(seconds: number) {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export default function VideoApplicationForm({ jobs, additionalJobs = [] }: { jobs: JobOption[]; additionalJobs?: JobOption[] }) {
  const [values, setValues] = useState<Answers>({
    fullName: "", age: "", nationality: "", jobId: "", experienceYears: "", phone: "", telegram: "", termsAccepted: false, consent: false,
  });
  const [video, setVideo] = useState<File | null>(null);
  /** undefined while the browser reads the length; null when it cannot. */
  const [duration, setDuration] = useState<number | null | undefined>(undefined);
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"upload" | "confirm">("upload");
  const [progress, setProgress] = useState(0);
  const [applicationCheck, setApplicationCheck] = useState("");
  const [result, setResult] = useState<{ reference: string; jobTitle: string } | null>(null);
  const [copyNotice, setCopyNotice] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submittingRef = useRef(false);
  const submissionKeyRef = useRef<string | null>(null);
  const uploadRef = useRef<UploadState | null>(null);
  const videoTokenRef = useRef(0);

  function update<K extends keyof Answers>(key: K, value: Answers[K]) {
    submissionKeyRef.current = null;
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }
  async function chooseVideo(file: File | null) {
    submissionKeyRef.current = null;
    uploadRef.current = null;
    setVideo(file);
    setDuration(undefined);
    setErrors((current) => ({ ...current, video: undefined }));
    if (!file) return;
    const token = ++videoTokenRef.current;
    const length = await readVideoDuration(file);
    if (token !== videoTokenRef.current) return;
    setDuration(length);
    setErrors((current) => ({ ...current, video: videoProblem(file, length) }));
  }
  function videoProblem(file: File | null, length: number | null | undefined) {
    if (!file) return "Add a video of yourself doing the actual work.";
    if (!videoMime(file.name)) return "Choose an MP4, MOV, M4V, WEBM or 3GP video.";
    if (!file.size) return "This video is empty. Choose it again.";
    if (file.size > MAX_VIDEO_BYTES) return `This video is ${(file.size / 1024 / 1024).toFixed(0)} MB. Keep it within ${VIDEO_MB} MB: record in HD (720p or 1080p) instead of 4K, or trim it.`;
    if (typeof length === "number" && length < MIN_VIDEO_SECONDS) return `This video is only ${minutes(length)} long. Record at least one minute (1:00) of yourself doing the work.`;
  }
  function payload() {
    const number = (value: string) => value.trim() === "" ? undefined : Number(value);
    return {
      form: VIDEO_FORM_VERSION, fullName: values.fullName, age: number(values.age), nationality: values.nationality,
      jobId: values.jobId, experienceYears: number(values.experienceYears), phone: values.phone, telegram: values.telegram,
      termsAccepted: values.termsAccepted, consent: values.consent,
    };
  }
  function showErrors(next: FormErrors) {
    setErrors(next);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true'], [data-form-error]")?.focus());
  }
  async function postJson(url: string, body: unknown) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
    let answer: { error?: string; code?: string; fieldErrors?: FormErrors; uploadUrl?: string; reference?: string; jobTitle?: string };
    try { answer = await response.json(); }
    catch { answer = {}; }
    return { ok: response.ok, status: response.status, answer };
  }

  async function submit() {
    if (submittingRef.current) return;
    const parsed = videoApplicationSchema.safeParse(payload());
    const next: FormErrors = parsed.success ? {} : fieldErrors(parsed.error);
    if (duration === undefined && video) next.video = "We are still checking your video. Wait a moment, then select Submit.";
    const problem = videoProblem(video, duration);
    if (problem) next.video = problem;
    if (Object.values(next).some(Boolean) || !parsed.success || !video) { showErrors(next); return; }
    submittingRef.current = true;
    setBusy(true); setError(""); setStage("upload"); setProgress(0);
    const fail = (message: string) => { setError(message); setBusy(false); submittingRef.current = false; };
    try {
      // 1. Open a private Drive upload for this video, unless one is already open.
      let upload = uploadRef.current?.file === video ? uploadRef.current : null;
      if (!upload) {
        const uploadId = crypto.randomUUID();
        const opened = await postJson("/api/video-applications/upload", {
          payload: parsed.data, uploadId, video: { name: video.name, size: video.size, durationSeconds: duration ?? null },
        });
        if (!opened.ok || !opened.answer.uploadUrl) {
          if (opened.answer.fieldErrors) showErrors(opened.answer.fieldErrors);
          fail(opened.answer.error || "We couldn’t start the video upload. Please try again.");
          return;
        }
        upload = { file: video, uploadId, uploadUrl: opened.answer.uploadUrl, started: false };
        uploadRef.current = upload;
      }
      // 2. Send the video straight to Google Drive, in parts.
      if (!upload.fileId) {
        const resume = upload.started;
        upload.started = true;
        try {
          upload.fileId = await uploadVideoToDrive(upload.uploadUrl, video, (sent) => setProgress(Math.min(95, Math.round((sent / video.size) * 95))), resume);
        } catch (problem) {
          if (problem instanceof VideoUploadError && problem.restart) uploadRef.current = null;
          fail(problem instanceof VideoUploadError ? problem.message : "Your connection was interrupted. Select Submit to continue uploading.");
          return;
        }
      }
      // 3. Record the answers with the stored video.
      setStage("confirm"); setProgress(97);
      submissionKeyRef.current ||= crypto.randomUUID();
      const saved = await postJson("/api/video-applications", {
        payload: parsed.data, submissionKey: submissionKeyRef.current, applicationCheck,
        video: { uploadId: upload.uploadId, fileId: upload.fileId, name: video.name, size: video.size, durationSeconds: duration ?? null },
      });
      if (saved.ok && saved.answer.reference && saved.answer.jobTitle) {
        setProgress(100);
        setResult({ reference: saved.answer.reference, jobTitle: saved.answer.jobTitle });
        setBusy(false);
        requestAnimationFrame(() => headingRef.current?.focus());
        return;
      }
      if (saved.answer.code === "VIDEO_UNAVAILABLE") uploadRef.current = null;
      if (saved.answer.fieldErrors) showErrors(saved.answer.fieldErrors);
      fail(saved.answer.error || "We couldn’t submit your application. Please check your details and try again.");
    } catch {
      fail("We couldn’t connect. Your application has not been confirmed. Check your connection and select Submit again.");
    }
  }

  function describedBy(id: string, help?: boolean) {
    return [help ? `${id}-help` : "", errors[id] ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  }
  function errorText(id: string) { return errors[id] ? <p className={styles.fieldError} id={`${id}-error`}>{errors[id]}</p> : null; }
  function input(key: "fullName" | "age" | "nationality" | "experienceYears" | "phone" | "telegram", label: string,
    options: { type?: string; wide?: boolean; help?: string; placeholder?: string; autoComplete?: string; max?: number; numeric?: boolean; icon?: ReactNode } = {}) {
    return <div className={`${styles.field} ${options.wide ? styles.full : ""}`}>
      <label htmlFor={key}>{options.icon}{label}<span className={styles.asterisk}>*</span></label>
      <input id={key} name={key} type={options.type || "text"} value={values[key]} maxLength={options.max} placeholder={options.placeholder}
        autoComplete={options.autoComplete} inputMode={options.numeric ? "numeric" : undefined} min={options.numeric ? 0 : undefined}
        disabled={busy} aria-required="true" aria-invalid={Boolean(errors[key])} aria-describedby={describedBy(key, Boolean(options.help))}
        onChange={(event) => update(key, event.target.value)} />
      {options.help && <p className={styles.help} id={`${key}-help`}>{options.help}</p>}
      {errorText(key)}
    </div>;
  }
  const brandIcon = (name: "whatsapp" | "telegram") =>
    <Image src={`/brand/messaging/${name}.svg`} width={20} height={20} alt="" aria-hidden="true" unoptimized className={styles.contactBrandIcon} />;
  const errorCount = Object.values(errors).filter(Boolean).length;
  const videoHelp = video && !errors.video
    ? duration === undefined ? "Checking the video length…" : duration === null ? "Your browser can’t read this video’s length. Please make sure it is at least one minute long." : `Video length: ${minutes(duration)}.`
    : "";

  return <div className={styles.page}>
    <div className={styles.shell}>
      <Link href="/jobs" className={styles.back}><ArrowLeft size={16} /> Back to opportunities</Link>
      <article className={styles.card} aria-label="Video application">
        <header className={styles.brandHeader}><BrandLockup /><span>VIDEO APPLICATION</span></header>
        {result ? <div className={styles.success}>
          <CheckCircle2 size={48} aria-hidden="true" />
          <h1 ref={headingRef} tabIndex={-1}>Application received</h1>
          <p>Your video application for <strong>{result.jobTitle}</strong> has been received.</p>
          <div className={styles.reference}><span>Your reference</span><strong>{result.reference}</strong>
            <button type="button" onClick={async () => {
              try { await navigator.clipboard.writeText(result.reference); setCopyNotice("Reference copied."); }
              catch { setCopyNotice("Select and copy your reference above to save it."); }
            }}>Copy reference <FileText size={16} /></button>
            {copyNotice && <span role="status">{copyNotice}</span>}
          </div>
          <p>Save this reference. The recruitment team will watch your video and contact you on WhatsApp or Telegram about the next steps.</p>
          <Link href="/jobs" className="button button-primary">Explore opportunities <ArrowRight size={17} /></Link>
        </div> : <form ref={formRef} className={styles.form} aria-label="Video application form" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <div className={styles.intro}>
            <h1 ref={headingRef} tabIndex={-1}>Video application form</h1>
            <p>Answer a few short questions and send us a video of yourself doing the actual work. It only takes a few minutes.</p>
            <span className={styles.rule} />
          </div>
          <p className={styles.requiredNote}><span>*</span> Required information</p>
          {errorCount > 0 && <p className={styles.errorSummary} role="alert">Please check the highlighted answers before submitting.</p>}
          <div hidden inert aria-hidden="true"><label htmlFor="application-check">Leave this blank</label><input id="application-check" name="applicationCheck" tabIndex={-1} autoComplete="off" value={applicationCheck} onChange={(event) => setApplicationCheck(event.target.value)} /></div>

          <section className={styles.grid} aria-label="About you">
            {input("fullName", "Your complete name", { wide: true, autoComplete: "name", max: 120, placeholder: "First name, middle name and last name", help: "Write your name as it appears on your passport." })}
            {input("age", "Age", { type: "number", numeric: true, max: 2, placeholder: "e.g. 32" })}
            {input("nationality", "Nationality", { max: 60, placeholder: "e.g. Filipino" })}
            <div className={`${styles.field} ${styles.full}`}>
              <label htmlFor="jobId">Position applying for<span className={styles.asterisk}>*</span></label>
              <select id="jobId" name="jobId" value={values.jobId} disabled={busy} aria-required="true" aria-invalid={Boolean(errors.jobId)} aria-describedby={describedBy("jobId")}
                onChange={(event) => update("jobId", event.target.value)}>
                <option value="">Select a position</option>
                {additionalJobs.length ? <>
                  <optgroup label="Open positions">{jobs.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}</optgroup>
                  <optgroup label="Other positions">{additionalJobs.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}</optgroup>
                </> : jobs.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
              </select>
              {errorText("jobId")}
            </div>
            {input("experienceYears", "Total years of experience in this position", { type: "number", numeric: true, max: 2, placeholder: "e.g. 5", wide: true,
              help: "Count only your experience in the position you selected above." })}
            {input("phone", "WhatsApp number", { type: "tel", autoComplete: "tel", max: 30, placeholder: "+63 912 345 6789", help: "Include the country code.", icon: brandIcon("whatsapp") })}
            {input("telegram", "Telegram number", { type: "tel", max: 30, placeholder: "+63 912 345 6789", help: "Include the country code.", icon: brandIcon("telegram") })}
          </section>

          <section className={styles.section} aria-labelledby="video-heading">
            <h2 id="video-heading">Your work video</h2><span className={styles.rule} />
            <p className={styles.sectionIntro}>Record <strong>at least one minute</strong> of yourself <strong>doing the actual work</strong> for the position you chose, for example welding, cooking, cleaning a room, driving or operating a machine. Make sure we can see your face and your hands at work.</p>
            <div className={styles.uploads}>
              <AttachmentUpload id="video" label="Upload your video (at least 1 minute)" required accept={VIDEO_ACCEPT} maxBytes={MAX_VIDEO_BYTES}
                hint={`One video, at least 1 minute long and up to ${VIDEO_MB} MB. If your video is too big, record in HD (720p or 1080p) instead of 4K.`}
                file={video} error={errors.video} disabled={busy} onChange={(file) => { void chooseVideo(file); }} />
            </div>
            {videoHelp && <p className={styles.help} role="status">{videoHelp}</p>}
            <p className={styles.privacyHint}><LockKeyhole size={16} aria-hidden="true" />Your video is private and available only to authorized recruitment staff.</p>
          </section>

          <section className={styles.section} aria-labelledby="terms-heading">
            <h2 id="terms-heading">Terms and Conditions</h2><span className={styles.rule} />
            <label className={styles.consent}><input id="termsAccepted" type="checkbox" checked={values.termsAccepted} disabled={busy} aria-required="true" aria-invalid={Boolean(errors.termsAccepted)} aria-describedby={errors.termsAccepted ? "termsAccepted-error" : undefined} onChange={(event) => update("termsAccepted", event.target.checked)} /><span>I agree to the <Link href="/terms" target="_blank" rel="noopener noreferrer">terms and conditions</Link> provided by Jobs in Croatia. By providing my contact details, I agree to receive messages about my application.</span></label>
            {errorText("termsAccepted")}
            <label className={styles.consent}><input id="consent" type="checkbox" checked={values.consent} disabled={busy} aria-required="true" aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? "consent-error" : undefined} onChange={(event) => update("consent", event.target.checked)} /><span>I agree to the <Link href="/privacy" target="_blank" rel="noopener noreferrer">privacy policy</Link> provided by Jobs in Croatia and understand that my information and video will be used in accordance with the policy.</span></label>
            {errorText("consent")}
            <p className={styles.feeNotice}><CheckCircle2 size={20} aria-hidden="true" /><strong>No placement fee.</strong></p>
          </section>
          {error && <p className={styles.errorSummary} role="alert">{error}</p>}
          {busy && <div className={styles.progress} role="status"><p>{stage === "upload" ? "Uploading your video — keep this page open" : "Confirming receipt…"}<span>{progress}%</span></p><progress value={progress} max={100} aria-label="Upload progress" /></div>}
          <button className={styles.submit} type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit"}<ArrowRight size={18} aria-hidden="true" /></button>
          <p className={styles.saveNote}>Check your answers before submitting. A 100 MB video can take several minutes on mobile data; Wi-Fi is faster.</p>
          <div className={styles.policyLinks}><Link href="/privacy">Privacy Policy</Link><span>|</span><Link href="/terms">Terms of Service</Link></div>
        </form>}
      </article>
    </div>
  </div>;
}
