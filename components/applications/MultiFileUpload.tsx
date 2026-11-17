"use client";

import { useRef, useState, type DragEvent } from "react";
import { AlertCircle, CheckCircle2, FileText, Upload, X } from "lucide-react";
import styles from "./AttachmentUpload.module.css";
import listStyles from "./MultiFileUpload.module.css";

type MultiFileUploadProps = {
  id: string;
  label: string;
  required?: boolean;
  hint: string;
  accept: string;
  maxFiles: number;
  limitsText: string;
  files: File[];
  fileErrors?: (string | undefined)[];
  error?: string;
  disabled?: boolean;
  busy?: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
};

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`;
}

/** An upload box that takes several files, e.g. one photo per IDP page. */
export default function MultiFileUpload({
  id, label, required = false, hint, accept, maxFiles, limitsText, files, fileErrors = [], error, disabled = false, busy = false, onAdd, onRemove,
}: MultiFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const displayError = selectionError || error;
  const room = maxFiles - files.length;
  const full = room <= 0;
  const blocked = disabled || busy || full;

  function select(chosen: File[]) {
    if (blocked || !chosen.length) return;
    setSelectionError(chosen.length > room ? `You can add up to ${maxFiles} files here. Only the first ${room} were added.` : "");
    onAdd(chosen.slice(0, room));
  }
  function dragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (blocked) return;
    dragDepth.current += 1;
    setDragging(true);
  }
  function dragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  return <div className={`${styles.field} ${files.length ? styles.selected : ""} ${displayError ? styles.invalid : ""} ${disabled ? styles.disabled : ""}`}>
    <div className={styles.heading}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <span className={required ? styles.required : styles.optional}>{required ? "Required" : "Optional"}</span>
    </div>
    <p className={styles.hint} id={`${id}-hint`}>{hint}</p>
    {files.length > 0 && <ol className={listStyles.list} aria-label={`${label}: selected files`}>
      {files.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className={fileErrors[index] ? listStyles.bad : undefined}>
        <span className={listStyles.icon} aria-hidden="true">{fileErrors[index] ? <FileText size={18} /> : <CheckCircle2 size={18} />}</span>
        <span className={listStyles.details}>
          <strong title={file.name}>{index + 1}. {file.name}</strong>
          <span>{fileSize(file.size)} · {fileErrors[index] || "Ready to submit"}</span>
        </span>
        <button type="button" className={styles.remove} disabled={disabled || busy} aria-label={`Remove ${file.name}`} onClick={() => { setSelectionError(""); onRemove(index); }}>
          <X size={16} aria-hidden="true" /> Remove
        </button>
      </li>)}
    </ol>}
    <div className={`${styles.dropzone} ${dragging ? styles.dragging : ""}`}
      onDragEnter={dragEnter} onDragLeave={dragLeave}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = blocked ? "none" : "copy"; }}
      onDrop={(event) => { event.preventDefault(); dragDepth.current = 0; setDragging(false); select(Array.from(event.dataTransfer.files)); }}>
      <input ref={inputRef} id={id} name={id} type="file" multiple className={styles.input} accept={accept} disabled={blocked}
        aria-required={required} aria-invalid={Boolean(displayError)}
        aria-describedby={[`${id}-hint`, `${id}-limits`, ...(displayError ? [`${id}-error`] : [])].join(" ")}
        aria-label={files.length ? `Add more files: ${label}` : `Choose files: ${label}`}
        onChange={(event) => { select(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ""; }} />
      <span className={styles.icon} aria-hidden="true"><Upload size={25} /></span>
      <div className={styles.instructions}>
        <strong className={styles.choose}>{full ? "Maximum files added" : busy ? "Preparing your files…" : dragging ? "Drop your files here" : files.length ? "Add more files" : "Choose files"}</strong>
        <span>{full ? "Remove a file to add a different one" : "Tap to browse. You can select several files at once."}</span>
      </div>
    </div>
    <div className={styles.footer}>
      <p className={styles.limits} id={`${id}-limits`}>{limitsText} · {files.length} of {maxFiles} files added</p>
    </div>
    <span className={styles.srOnly} role="status">{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected.` : "No files selected."}</span>
    {displayError && <p className={styles.error} id={`${id}-error`} role="alert"><AlertCircle size={17} aria-hidden="true" /> <span>{displayError}</span></p>}
  </div>;
}
