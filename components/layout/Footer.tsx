import { BrandLockup } from "@/components/ui/Brand";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export function Footer() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <Link href="/" className="wordmark" aria-label="Jobs in Croatia home">
            <BrandLockup />
          </Link>
          <p>
            Good work. A better future.
            <br />
            For Filipino workers taking their next step in Croatia.
          </p>
        </div>
        <div className="footer-links">
          <div>
            <span className="eyebrow">Explore</span>
            <Link href="/jobs">Find opportunities</Link>
            <Link href="/job-fair">Job Fair Philippines 2026</Link>
            <Link href="/#industries">Our industries</Link>
            <Link href="/#how-it-works">How it works</Link>
          </div>
          <div>
            <span className="eyebrow">Get to know us</span>
            <Link href="/about">About Jobs in Croatia</Link>
            <Link href="/contact">
              Application help <ArrowUpRight size={14} />
            </Link>
            {email && <a href={`mailto:${email}`}>{email}</a>}
            <Link href="/admin">Recruitment team</Link>
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} Jobs in Croatia. Every next step matters.
        </span>
        <span>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms of use</Link>
        </span>
        <span className="footer-location">
          <i /> Built for new beginnings.
        </span>
      </div>
    </footer>
  );
}
