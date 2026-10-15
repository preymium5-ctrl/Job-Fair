export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="15" fill="#142D4E" />
      <path d="M24 24v-4a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4" stroke="#FFFFFF" strokeWidth="3.5" />
      <rect x="12" y="23" width="40" height="28" rx="5" fill="#FFFFFF" />
      <path d="M13 35h38" stroke="#142D4E" strokeOpacity=".18" strokeWidth="2" />
      <rect x="24" y="29" width="16" height="16" rx="2" fill="#FFFFFF" />
      <path d="M26 31h4v4h-4zm8 0h4v4h-4zm-4 4h4v4h-4zm-4 4h4v4h-4zm8 0h4v4h-4z" fill="#CC3544" />
    </svg>
  );
}

export function BrandLockup() {
  return (
    <span className="brand-lockup" aria-label="Jobs in Croatia">
      <BrandMark className="brand-mark" />
      <span className="brand-name">
        <span className="brand-name-prefix">Jobs in</span>
        <span className="brand-name-country">Croatia</span>
      </span>
    </span>
  );
}
