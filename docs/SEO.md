# Google Search and Search Console

The site targets **Job Fair Philippines 2026**, **jobs abroad for Filipinos**, and skilled work in **Croatia** through useful page content, descriptive titles, canonical links, social previews, and structured data. Search visibility and positions are determined by Google; this setup does not guarantee rankings or indexing.

## Domain and deployment

- Primary canonical origin: `https://www.jobsincroatiaa.com`, matching the existing Vercel redirect from the apex domain.
- `jobstreetcroatia.com`, `www.jobstreetcroatia.com`, and `jobsincroatiaa.com` redirect permanently to the primary host, retaining paths and query parameters. Both domains must remain connected to the Vercel project with valid DNS and HTTPS certificates.
- The canonical configuration is centralized in `data/site.ts`. Configure production `APP_ORIGIN` and `NEXT_PUBLIC_SITE_URL` as `https://www.jobsincroatiaa.com` as well, so application origin checks use the address visitors actually see.
- Use `CHAPTER_LOCAL_MODE=false` on Vercel. Set `INDEX_SITE=true` for the public production deployment. When omitted, production enables indexing; `INDEX_SITE=false` explicitly pauses it. Local mode and Vercel previews always remain noindex, even with `INDEX_SITE=true`.
- Public pages use the source-controlled 17-role fair catalog when production has no `DATABASE_URL`. When a database is configured, they use its published jobs, including staff edits and closures. This keeps the public guide and sitemap available without a separate catalog database. Applicant submission and staff routes retain their existing storage requirements; the public catalog fallback never reads or changes private applicant data. The live application prerequisites in [VERCEL.md](VERCEL.md) still apply.

## Search Console connection

1. Open [Google Search Console](https://search.google.com/search-console) with the site owner's Google account.
2. Add a URL-prefix property for **`https://www.jobsincroatiaa.com/`**. Google's verification HTML file for the owner's account is included at `public/google34ca7e130748a630.html`. Once deployed, use **HTML file → Verify** in that account. Keep the file available after verification. Alternatively, select **HTML tag**, copy only its `content` value, and put that value in the **production** Vercel environment variable `GOOGLE_SITE_VERIFICATION`. The application renders it in the page head. Redeploy, then click Verify. Keep the chosen verification method configured.
3. Alternatively, add a Domain property for `jobsincroatiaa.com` and publish Google's exact DNS TXT record with the domain provider. This covers both www and the apex. Domain properties use DNS verification; the HTML-tag option is for URL-prefix properties.
4. Submit **`https://www.jobsincroatiaa.com/sitemap.xml`** in Sitemaps. The public sitemap contains the five main information pages and every published, non-example role, including the 17 job-fair roles. Drafts, closed roles, application forms, admin and API routes are excluded. It stays empty on non-indexable deployments.
5. Inspect the homepage, `/job-fair`, `/jobs`, and representative role URLs. Use **Test live URL**, review the canonical and indexing permissions, and request indexing of the main pages. Review Page indexing, Sitemaps, and Performance after Google processes the site.

## Structured data and content

The site uses WebSite, publisher Organization, WebPage, CollectionPage/ItemList and BreadcrumbList JSON-LD. Structured data reflects the visible content. The public guide includes interview dates, planned testing dates, role groups, document guidance and applicant questions. It does not invent an event venue, contact details, recruitment accreditation, employer offers or salaries.

Event rich-result markup is deferred until the required specific physical venue is confirmed. JobPosting rich-result markup is deferred until actual employer vacancy details, hiring organization, work location and other required facts are available; proposed net salary ranges are not marked as employer-provided baseSalary. Normal search indexing of useful role guides does not require JobPosting markup. Application pages carry noindex; robots.txt allows Google to crawl them to read that directive. Admin and API routes remain excluded from crawling.

Verify the rendered metadata, sitemap and redirects after deployment. Use [Google's Rich Results Test](https://search.google.com/test/rich-results) for supported types and [Schema Markup Validator](https://validator.schema.org/) for general JSON-LD. No analytics, third-party tracking or applicant data is added by this SEO implementation.

## References

- [Search Console ownership verification](https://support.google.com/webmasters/answer/9008080)
- [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Canonical URLs and redirects](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Event structured data](https://developers.google.com/search/docs/appearance/structured-data/event)
- [JobPosting structured data](https://developers.google.com/search/docs/appearance/structured-data/job-posting)
