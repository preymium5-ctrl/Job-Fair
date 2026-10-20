import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { proposedJobs, proposalV1Jobs } from "../data/jobs";
import { getJobFairRole } from "../data/job-fair";
import { jobPositionLabel } from "../data/job-positions";

// Read-only integration smoke test. Run against an already-running local server:
// npx tsx scripts/smoke-routes.ts [http://127.0.0.1:3000]
// Requests are sequential to avoid competing with browser or database checks.
const base = new URL(process.argv[2] || "http://127.0.0.1:3000");
if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)) {
  throw new Error("This smoke test is intended for a local preview server.");
}
type RouteResult = {
  route: string;
  status: number;
  passed: boolean;
  errors: string[];
};
const results: RouteResult[] = [];
const knownSlugs = new Set(proposedJobs.map((job) => job.slug));
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function check(
  route: string,
  expectedStatus: number | number[] = 200,
  validate?: (html: string) => string[],
) {
  const response = await fetch(new URL(route, base), {
    signal: AbortSignal.timeout(20000),
    redirect: "manual",
  });
  const html = await response.text();
  const acceptedStatuses = Array.isArray(expectedStatus)
    ? expectedStatus
    : [expectedStatus];
  const errors = acceptedStatuses.includes(response.status)
    ? []
    : [
        `Expected ${acceptedStatuses.join(" or ")}, received ${response.status}`,
      ];
  if (acceptedStatuses.includes(response.status) && validate)
    errors.push(...validate(html));
  const passed = errors.length === 0;
  results.push({ route, status: response.status, passed, errors });
  console.log(
    `${passed ? "PASS" : "FAIL"} ${response.status} ${route}${errors.length ? ` — ${errors.join("; ")}` : ""}`,
  );
}

async function main() {
  for (const route of [
    "/",
    "/jobs",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
  ])
    await check(route, 200, route === "/jobs" ? (html) => {
      const errors: string[] = [];
      for (const job of proposedJobs)
        if (!html.includes(`href="/jobs/${job.slug}"`)) errors.push(`Missing position: ${job.slug}`);
      if (!html.includes("23") || !html.includes("11100")) errors.push("Missing current position or slot total");
      return errors;
    } : undefined);
  await check("/job-fair", [307, 308]);
  for (const job of proposedJobs) {
    await check(`/jobs/${job.slug}`, 200, (html) => {
      const errors: string[] = [];
      if (!new RegExp(`<h1[^>]*>${escapeRegex(job.title)}(?:<|[.])`).test(html))
        errors.push("Missing correct role heading");
      if (!html.includes(`href="/jobs/${job.slug}/apply"`))
        errors.push("Missing role-specific application link");
      if (!html.includes("Salary range") || !html.includes(job.salary!) || !html.includes("EUR / month"))
        errors.push("Missing listed monthly salary range");
      const fairRole = getJobFairRole(job);
      if (fairRole) {
        for (const employer of fairRole.employers)
          if (!html.includes(employer.name)) errors.push(`Missing role allocation: ${employer.name}`);
        if (!html.includes(fairRole.nc2)) errors.push("Missing role-specific NC2 guidance");
      }
      if (html.includes('"@type":"JobPosting"'))
        errors.push("Unconfirmed proposal exposes JobPosting structured data");
      const roleLinks = [
        ...html.matchAll(/href="\/jobs\/([a-z0-9-]+)(?:\/apply)?"/g),
      ].map((match) => match[1]);
      if (roleLinks.some((slug) => !knownSlugs.has(slug)))
        errors.push("Unknown related role link");
      if (new Set(roleLinks.filter((slug) => slug !== job.slug)).size !== 3)
        errors.push("Expected three distinct related roles");
      return errors;
    });
    await check(`/jobs/${job.slug}/apply`, 200, (html) => {
      const errors: string[] = [];
      if (!html.includes(job.title)) errors.push("Missing selected role title");
      if (!html.includes("Welcome! Please tell us about yourself."))
        errors.push("Missing application form heading");
      const choices = html.match(/<select[^>]*id="jobId"[^>]*>([\s\S]*?)<\/select>/)?.[1] || "";
      if ((choices.match(/<option\b/g) || []).length !== 23)
        errors.push("Expected all 23 primary job choices");
      if (!choices.includes(`value="${job.id}" selected=""`) || !choices.includes(jobPositionLabel(job)))
        errors.push("Missing selected employer-specific position");
      if (!html.includes("Document requirements") || !html.includes("Form 18a"))
        errors.push("Missing document guidance");
      return errors;
    });
  }
  // Next.js preserves HTTP 200 if loading UI has already started streaming.
  // Its documented missing-resource contract includes not-found UI + noindex.
  const validateNotFound = (html: string) => {
    const errors: string[] = [];
    if (!html.includes("404 / A different direction"))
      errors.push("Missing not-found interface");
    if (
      !/<meta[^>]+name="robots"[^>]+content="noindex(?:[,"][^>]*)?/.test(html)
    )
      errors.push("Missing noindex directive");
    return errors;
  };
  await check("/jobs/not-a-real-role", [404, 200], validateNotFound);
  await check("/jobs/not-a-real-role/apply", [404, 200], validateNotFound);
  const imagePaths = [...new Set(proposedJobs.map((job) => job.image))];
  if (imagePaths.length !== proposalV1Jobs.length)
    throw new Error("Expected one existing illustration per distinct trade.");
  const imageHashes: string[] = [];
  const { readFile } = await import("node:fs/promises");
  for (const image of imagePaths) {
    const response = await fetch(new URL(image, base), {
      signal: AbortSignal.timeout(20000),
    });
    if (response.status !== 200 || !response.headers.get("content-type")?.startsWith("image/"))
      throw new Error(`Role image is not served correctly: ${image} (${response.status})`);
    await response.arrayBuffer();
    imageHashes.push(
      createHash("sha256")
        .update(await readFile(path.join(process.cwd(), "public", image)))
        .digest("hex"),
    );
  }
  if (new Set(imageHashes).size !== proposalV1Jobs.length)
    throw new Error("Proposed roles share duplicate image bytes.");
  const summary = {
    checkedAt: new Date().toISOString(),
    baseUrl: base.origin,
    passed: results.every((result) => result.passed),
    routeCount: results.length,
    uniqueRoleImages: imageHashes.length,
    results,
  };
  await mkdir(path.join(process.cwd(), ".qa"), { recursive: true });
  await writeFile(
    path.join(process.cwd(), ".qa", "route-smoke.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(
    `\n${summary.passed ? "PASS" : "FAIL"}: ${results.filter((result) => result.passed).length}/${results.length} routes; ${imageHashes.length} distinct role images.`,
  );
  if (!summary.passed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
