"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { AlertCircle, CheckCircle2, FileText, Upload, X } from "lucide-react";
import styles from "./AttachmentUpload.module.css";

type AttachmentUploadProps = {
  id: string;
  label: string;
  required?: boolean;
  hint: string;
  accept: string;
  maxBytes: number;
  file: File | null;
  error?: string;
  disabled?: boolean;
  onChange: (file: File | null) => void;
};

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`;
}

function acceptsFile(file: File, accept: string) {
  return accept.split(",").some((part) => {
    const type = part.trim().toLowerCase();
    if (!type) return false;
    if (type.startsWith(".")) return file.name.toLowerCase().endsWith(type);
    if (type.endsWith("/*")) return file.type.toLowerCase().startsWith(type.slice(0, -1));
    return file.type.toLowerCase() === type;
  });
}

function acceptedTypes(accept: string) {
  const names: Record<string, string> = {
    "application/pdf": "PDF",
    "application/msword": "DOC",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "image/*": "Images",
    "image/jpeg": "JPG",
    "image/png": "PNG",
  };
  return [...new Set(accept.split(",").map((part) => {
    const type = part.trim().toLowerCase();
    return names[type] || type.replace(/^\./, "").toUpperCase();
  }).filter(Boolean))].join(", ");
}

export default function AttachmentUpload({
  id,
  label,
  required = false,
  hint,
  accept,
  maxBytes,
  file,
  error,
  disabled = false,
  onChange,
}: AttachmentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const displayError = selectionError || error;
  const types = acceptedTypes(accept);
  const descriptionIds = [`${id}-hint`, `${id}-limits`, ...(displayError ? [`${id}-error`] : [])].join(" ");

  useEffect(() => {
    if (!file && inputRef.current) inputRef.current.value = "";
  }, [file]);

  function selectFiles(files: File[]) {
    if (disabled || files.length === 0) return;
    if (files.length > 1) {
      setSelectionError("Choose one file for this attachment. Upload other documents in their own boxes.");
      return;
    }
    const nextFile = files[0];
    if (nextFile.size > maxBytes) {
      setSelectionError(`This file is too large. Choose a file of ${fileSize(maxBytes)} or less.`);
    } else if (accept.trim() && !acceptsFile(nextFile, accept)) {
      setSelectionError(`Choose a supported file: ${types}.`);
    } else {
      setSelectionError("");
    }
    onChange(nextFile);
  }

  function dragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) return;
    dragDepth.current += 1;
    setDragging(true);
  }

  function dragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  return (
    <div
      className={`${styles.field} ${file ? styles.selected : ""} ${displayError ? styles.invalid : ""} ${disabled ? styles.disabled : ""}`}
    >
      <div className={styles.heading}>
        <label htmlFor={id} className={styles.label}>{label}</label>
        <span className={required ? styles.required : styles.optional}>
          {required ? "Required" : "Optional"}
        </span>
      </div>
      <p className={styles.hint} id={`${id}-hint`}>{hint}</p>
      <div
        className={`${styles.dropzone} ${dragging ? styles.dragging : ""}`}
        onDragEnter={dragEnter}
        onDragLeave={dragLeave}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = disabled ? "none" : "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          selectFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <input
          ref={inputRef}
          id={id}
          name={id}
          type="file"
          className={styles.input}
          accept={accept}
          disabled={disabled}
          required={required && !file}
          aria-required={required}
          aria-invalid={Boolean(displayError)}
          aria-describedby={descriptionIds}
          aria-label={file ? `Change ${label} attachment` : `Choose ${label} attachment`}
          onChange={(event) => {
            selectFiles(Array.from(event.currentTarget.files || []));
            event.currentTarget.value = "";
          }}
        />
        <span className={styles.icon} aria-hidden="true">
          {file ? (displayError ? <FileText size={25} /> : <CheckCircle2 size={25} />) : <Upload size={25} />}
        </span>
        {file ? (
          <div className={styles.fileDetails}>
            <strong className={styles.fileName} title={file.name}>{file.name}</strong>
            <span className={styles.fileMeta}>{fileSize(file.size)} · {displayError ? "Please check this file" : "Ready to submit"}</span>
            <span className={styles.choose}>Change file</span>
          </div>
        ) : (
          <div className={styles.instructions}>
            <strong className={styles.choose}>{dragging ? "Drop your file here" : "Choose a file"}</strong>
            <span>Tap to browse or drag and drop one file here</span>
          </div>
        )}
      </div>
      <div className={styles.footer}>
        <p className={styles.limits} id={`${id}-limits`}>
          {types ? `${types} · ` : ""}Maximum {fileSize(maxBytes)} per file
        </p>
        {file && (
          <button
            type="button"
            className={styles.remove}
            disabled={disabled}
            aria-label={`Remove ${label} attachment`}
            onClick={() => {
              setSelectionError("");
              if (inputRef.current) inputRef.current.value = "";
              onChange(null);
              inputRef.current?.focus();
            }}
          >
            <X size={16} aria-hidden="true" /> Remove
          </button>
        )}
      </div>
      <span className={styles.srOnly} role="status">
        {file ? `${file.name} selected. ${fileSize(file.size)}.` : "No file selected."}
      </span>
      {displayError && (
        <p className={styles.error} id={`${id}-error`} role="alert">
          <AlertCircle size={17} aria-hidden="true" /> <span>{displayError}</span>
        </p>
      )}
    </div>
  );
}
