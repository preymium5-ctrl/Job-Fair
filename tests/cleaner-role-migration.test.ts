import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { combinedRoleRecruitmentJobs, proposedJobs, proposalV1Jobs } from "../data/jobs";
import { getJobFairRole } from "../data/job-fair";
import { migrateSeparatedCleaningRoles, separatedCleaningRolesVersion } from "../lib/catalog-migration";
import { closeDatabase, getDatabase } from "../lib/db";
import { applications, audits, jobs, settings } from "../lib/schema";
import type { Application, Job } from "../lib/types";

const prior = combinedRoleRecruitmentJobs.find((job) => job.slug === "grinder-and-cleaner")!;
const grinder = proposedJobs.find((job) => job.id === prior.id)!;
const cleaner = proposedJobs.find((job) => job.slug === "cleaner")!;
const originalEnv = { ...process.env };
let temporaryDirectory: string;
let scenario = 0;

before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "chapter-cleaner-roles-test-"));
  Object.assign(process.env, { NODE_ENV: "test", CHAPTER_LOCAL_MODE: "true" });
  delete process.env.DATABASE_URL;
});
beforeEach(async () => {
  await closeDatabase();
  process.env.DATA_DIR = path.join(temporaryDirectory, String(++scenario));
});
after(async () => {
  await closeDatabase();
  if (!path.resolve(temporaryDirectory).startsWith(path.resolve(tmpdir()) + path.sep) ||
      !path.basename(temporaryDirectory).startsWith("chapter-cleaner-roles-test-"))
    throw new Error("Unexpected cleaner migration test cleanup path.");
  await rm(temporaryDirectory, { recursive: true, force: true });
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

async function insertJob(data: Job) {
  const db = await getDatabase();
  await db.insert(jobs).values({ id: data.id, slug: data.slug, status: data.status, data });
  return db;
}

test("Grinder and Cleaner have distinct catalog entries and updated proposed slots without new named-employer allocations", () => {
  assert.equal(grinder.title, "Grinder");
  assert.equal(cleaner.title, "Cleaner");
  assert.notEqual(grinder.id, cleaner.id);
  assert.notEqual(grinder.slug, cleaner.slug);
  assert.notEqual(grinder.image, cleaner.image);
  assert.ok(existsSync(path.join(process.cwd(), "public", cleaner.image)));
  assert.equal(cleaner.salary, grinder.salary);
  assert.equal(cleaner.openings, 250);
  assert.equal(getJobFairRole(cleaner), undefined);
  assert.equal(grinder.openings, 250);
  assert.equal(proposalV1Jobs.at(-1)?.title, "Grinder and Cleaner");
  assert.equal(proposalV1Jobs.at(-1)?.openings, 6);
});

test("deployed catalog gains Cleaner while Grinder ID, slots, and historical applications remain linked", async () => {
  const db = await insertJob(prior);
  const historical: Application = {
    id: "cleaner-split-history", reference: "CH-CLEANER-HISTORY", jobId: prior.id,
    jobTitle: prior.title, status: "Under Review", submittedAt: "2026-10-19T00:00:00.000Z",
    fullName: "Synthetic History", email: "history@example.test", phone: "+639171234567",
    country: "Philippines", recentJobTitle: "Grinder", experienceYears: 3,
    skills: "Grinding", education: "", summary: "", coverLetter: "", consent: true,
    resumeName: "synthetic.pdf", resumeKey: "resumes/synthetic.pdf", resumeMime: "application/pdf", isExample: true,
  };
  await db.insert(applications).values({ id: historical.id, jobId: historical.jobId,
    idempotencyKey: historical.id, requestHash: "synthetic", data: historical });
  await migrateSeparatedCleaningRoles(db);
  const rows = await db.select().from(jobs);
  assert.deepEqual(rows.find((row) => row.id === grinder.id)?.data, {
    ...prior, title: grinder.title, summary: grinder.summary, description: grinder.description,
    responsibilities: grinder.responsibilities, imageAlt: grinder.imageAlt,
  });
  assert.deepEqual(rows.find((row) => row.id === cleaner.id)?.data, cleaner);
  assert.deepEqual((await db.select().from(applications))[0].data, historical);
  const edited = { ...grinder, title: "Staff-reviewed Grinder", salary: "€1,100" };
  await db.update(jobs).set({ data: edited }).where(eq(jobs.id, grinder.id));
  await migrateSeparatedCleaningRoles(db);
  assert.deepEqual((await db.select().from(jobs).where(eq(jobs.id, grinder.id)))[0].data, edited);
  assert.equal((await db.select().from(audits).where(eq(audits.targetId, separatedCleaningRolesVersion))).length, 1);
});

test("role separation preserves staff copy, closed statuses, and a custom Cleaner URL", async () => {
  const edited = { ...prior, title: "Staff title", summary: "Staff summary", description: "Staff description",
    responsibilities: ["Staff duties"], imageAlt: "Staff photo", status: "closed" as const, openings: 33 };
  const db = await insertJob(edited);
  const custom = { ...cleaner, id: "staff-cleaner", title: "Staff Cleaner" };
  await insertJob(custom);
  await migrateSeparatedCleaningRoles(db);
  const rows = await db.select().from(jobs);
  assert.deepEqual(rows.find((row) => row.id === prior.id)?.data, edited);
  assert.deepEqual(rows.find((row) => row.id === custom.id)?.data, custom);
  assert.equal(rows.some((row) => row.id === cleaner.id), false);
  assert.equal((await db.select().from(settings).where(eq(settings.key, separatedCleaningRolesVersion))).length, 1);
});
