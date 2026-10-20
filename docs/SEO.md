# Google Search and Search Console

The site targets **Job Fair Philippines 2026**, **jobs abroad for Filipinos**, and skilled work in **Croatia** through useful page content, descriptive titles, canonical links, social previews, and structured data. Search visibility and positions are determined by Google; this setup does not guarantee rankings or indexing.

## Domain and deployment

- Primary canonical origin: `https://www.jobsincroatiaa.com`, matching the existing Vercel redirect from the apex domain.
- `jobstreetcroatia.com`, `www.jobstreetcroatia.com`, and `jobsincroatiaa.com` redirect permanently to the primary host, retaining paths and query parameters. Both domains must remain connected to the Vercel project with valid DNS and HTTPS certificates.
- The canonical configuration is centralized in `data/site.ts`. Configure production `APP_ORIGIN` and `NEXT_PUBLIC_SITE_URL` as `https://www.jobsincroatiaa.com` as well, so application origin checks use the address visitors actually see.
- Use `CHAPTER_LOCAL_MODE=false` on Vercel. Set `INDEX_SITE=true` for the public production deployment. When omitted, production enables indexing; `INDEX_SITE=false` explicitly pauses it. Local mode and Vercel previews always remain noindex, even with `INDEX_SITE=true`.
- Public pages use the source-controlled catalog of 23 employer-specific positions across 17 trade families when production has no `DATABASE_URL`. When a database is configured, they use its published jobs, including staff edits and closures. This keeps the public guide and sitemap available without a separate catalog database. Applicant submission and staff routes retain their existing storage requirements; the public catalog fallback never reads or changes private applicant data. The live application prerequisites in [VERCEL.md](VERCEL.md) still apply.

## Search Console connection

1. Open [Google Search Console](https://search.google.com/search-console) with the site owner's Google account.
2. Use a single **Domain property named `jobsincroatiaa.com`**, as requested by the site owner. Enter the bare domain without `https://` or `www`. This property automatically covers the website's www and apex addresses. Do not add separate www, protocol, or `jobstreetcroatia.com` properties unless the owner requests them.
3. Verify the Domain property using Google's exact DNS TXT or CNAME record in the Hostinger DNS manager for `jobsincroatiaa.com`. Keep the ownership records published after verification; they are separate from the website's A and www CNAME records. DNS records can be correct and publicly visible before Search Console refreshes its own lookup. If Google cannot find them yet, wait for propagation and recheck ownership. The legacy HTML verification file and optional `GOOGLE_SITE_VERIFICATION` setting support URL-prefix verification only; they cannot verify a Domain property.
4. Submit **`https://www.jobsincroatiaa.com/sitemap.xml`** in Sitemaps. The public sitemap contains four main information pages and every published, non-example position, including the 23 job-fair positions: 27 URLs for the source-controlled catalog. Drafts, closed roles, application forms, admin and API routes are excluded. It stays empty on non-indexable deployments.
5. Inspect the homepage, `/jobs`, and representative position URLs. `/job-fair` redirects to `/jobs`. Use **Test live URL**, review the canonical and indexing permissions, and request indexing of the main pages. Review Page indexing, Sitemaps, and Performance after Google processes the site.

## Structured data and content

The root layout explicitly advertises the brand's square 512×512 PNG at the stable `/favicon.png` URL on every page, including the homepage. Next.js retains the six-size `/favicon.ico` (16–256px) fallback, and the Apple touch icon uses `/apple-icon.png` (180×180px). The original SVG and 192px PNG remain available. Run `npm run icons:generate` after editing the source `public/brand/jobs-in-croatia-mark-512.png` to regenerate all favicon assets.

The homepage and favicon files must remain accessible to Googlebot and Googlebot-Image. After deploying a favicon update, request indexing of `https://www.jobsincroatiaa.com/` through Search Console's URL Inspection tool. [Google's favicon guidance](https://developers.google.com/search/docs/appearance/favicon-in-search) says recrawling and processing can take several days to several weeks; favicon display is not guaranteed even when the technical requirements are met.

The site uses WebSite, publisher Organization, WebPage, CollectionPage/ItemList and BreadcrumbList JSON-LD. Structured data reflects the visible content. Position titles and directory item names include the employer so repeated trade titles remain distinguishable, and each position has its own canonical URL. The public guide includes interview dates, planned testing dates, role groups, document guidance and applicant questions. It does not invent an event venue, contact details, recruitment accreditation, employer offers or salaries.

Event rich-result markup is deferred until the required specific physical venue is confirmed. JobPosting rich-result markup is deferred until actual employer vacancy details, hiring organization, work location and other required facts are available; proposed net salary ranges are not marked as employer-provided baseSalary. Normal search indexing of useful role guides does not require JobPosting markup. Application pages carry noindex; robots.txt allows Google to crawl them to read that directive. Admin and API routes remain excluded from crawling.

Verify the rendered metadata, sitemap and redirects after deployment. Use [Google's Rich Results Test](https://search.google.com/test/rich-results) for supported types and [Schema Markup Validator](https://validator.schema.org/) for general JSON-LD. No analytics, third-party tracking or applicant data is added by this SEO implementation.

## References

- [Search Console ownership verification](https://support.google.com/webmasters/answer/9008080)
- [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Canonical URLs and redirects](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Event structured data](https://developers.google.com/search/docs/appearance/structured-data/event)
- [JobPosting structured data](https://developers.google.com/search/docs/appearance/structured-data/job-posting)
