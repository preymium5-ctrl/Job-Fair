import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: process.env.INDEX_SITE === "true" ? "/" : undefined,
      disallow:
        process.env.INDEX_SITE === "true"
          ? ["/admin", "/api/", "/jobs/*/apply"]
          : "/",
    },
    sitemap:
      process.env.INDEX_SITE === "true"
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`
        : undefined,
  };
}
