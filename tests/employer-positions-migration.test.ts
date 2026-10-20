import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { groupedRecruitmentJobs, proposedJobs } from "../data/jobs";
import {
  employerPositionsVersion,
  filipinoWorkerImageVersion,
  hiringContentVersion,
  hiringWorkerCountsVersion,
  jobFairCatalogVersion,
  maximumAgeRequirementVersion,
  migrateEmployerPositions,
  migrateProposedJobCatalog,
  minimumExperienceVersion,
  proposalCatalogVersion,
} from "../lib/catalog-migration";
import { closeDatabase, getDatabase } from "../lib/db";
import { applications, audits, jobs, settings } from "../lib/schema";
import type { Application, Job } from "../lib/types";

let temporaryDirectory: string;
let scenario = 0;
const originalEnv = { ...process.env };
const legacyVersions = [
  proposalCatalogVersion, jobFairCatalogVersion, filipinoWorkerImageVersion,
  hiringContentVersion, minimumExperienceVersion, hiringWorkerCountsVersion,
  maximumAgeRequirementVersion,
];

before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "chapter-employer-positions-test-"));
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
      !path.basename(temporaryDirectory).startsWith("chapter-employer-positions-test-"))
    throw new Error("Unexpected employer position test cleanup path.");
  await rm(temporaryDirectory, { recursive: true, force: true });
  for (const key of Object.keys(process.env))
    if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

async function seedGroupedCatalog() {
  const db = await getDatabase();
  for (const job of groupedRecruitmentJobs)
    await db.insert(jobs).values({ id: job.id, slug: job.slug, status: job.status, data: job });
  for (const key of legacyVersions)
    await db.insert(settings).values({ key, value: "already applied before employer split" });
  return db;
}

function grouped(slug: string) {
  const job = groupedRecruitmentJobs.find((item) => item.slug === slug);
  assert.ok(job, `Expected legacy role ${slug}`);
  return job;
}

function position(slug: string) {
  const job = proposedJobs.find((item) => item.slug === slug);
  assert.ok(job, `Expected employer position ${slug}`);
  return job;
}

function historicalApplication(job: Job): Application {
  return {
    id: "employer-split-history", reference: "CH-EMPLOYER-HISTORY", jobId: job.id,
    jobTitle: job.title, status: "Under Review", submittedAt: "2026-10-19T00:00:00.000Z",
    fullName: "Synthetic History", email: "history@example.test", phone: "+639171234567",
    country: "Philippines", recentJobTitle: "Fabricator", experienceYears: 5,
    skills: "Fabrication", education: "", summary: "", coverLetter: "", consent: true,
    referralSource: "Facebook", preferredEmployer: "Vertiv", resumeName: "synthetic.pdf",
    resumeKey: "resumes/synthetic-history.pdf", resumeMime: "application/pdf", isExample: true,
  };
}

test("fresh catalog seeding produces 23 stable employer positions and keeps the existing worker total", async () => {
  const db = await getDatabase();
  await migrateProposedJobCatalog(db);
  const rows = await db.select().from(jobs);
  assert.equal(rows.length, 23);
  assert.equal(rows.filter((row) => row.status === "published").length, 23);
  assert.deepEqual(rows.map((row) => row.id).sort(), proposedJobs.map((job) => job.id).sort());
  for (const job of proposedJobs) {
    const row = rows.find((item) => item.id === job.id)!;
    assert.equal(row.slug, job.slug);
    assert.equal(row.data.openings, job.openings, job.slug);
  }
  for (const job of groupedRecruitmentJobs)
    assert.equal(rows.find((row) => row.id === job.id)?.slug, job.slug);
  assert.equal(rows.reduce((total, row) => total + (row.data.openings ?? 0), 0), 11100);
  const [event] = await db.select().from(audits).where(eq(audits.targetId, employerPositionsVersion));
  assert.equal(event.action, "catalog.employer-positions-expanded");
  assert.equal((event.details.addedIds as string[]).length, 6);
  assert.equal((event.details.updatedIds as string[]).length, 4);
  await migrateProposedJobCatalog(db);
  assert.deepEqual(await db.select().from(jobs), rows);
  assert.equal((await db.select().from(settings).where(eq(settings.key, employerPositionsVersion))).length, 1);
  assert.equal((await db.select().from(audits).where(eq(audits.targetId, employerPositionsVersion))).length, 1);
});

test("17-role upgrade preserves historical applications, custom jobs and closed parent content", async () => {
  const db = await seedGroupedCatalog();
  const parent: Job = {
    ...grouped("fabricator"), title: "Staff-reviewed fabricator", salary: "€1,234",
    status: "closed", summary: "Staff-approved summary", image: "/images/staff-approved.webp",
    requirements: ["Staff-approved requirements"],
  };
  await db.update(jobs).set({ status: parent.status, data: parent }).where(eq(jobs.id, parent.id));
  const custom: Job = { ...grouped("pipe-fitter"), id: "staff-custom-position", slug: "staff-custom-position", openings: 19 };
  await db.insert(jobs).values({ id: custom.id, slug: custom.slug, status: custom.status, data: custom });
  const historical = historicalApplication(parent);
  await db.insert(applications).values({ id: historical.id, jobId: historical.jobId, idempotencyKey: "employer-history", requestHash: "history", data: historical });
  await db.insert(audits).values({ id: "staff-audit-history", actorId: "staff", action: "application.status", targetId: historical.id, details: { preserved: true } });
  const auditsBefore = await db.select().from(audits).where(eq(audits.id, "staff-audit-history"));

  await migrateProposedJobCatalog(db);
  const result = await db.select().from(jobs);
  assert.equal(result.length, 24);
  assert.deepEqual(result.find((row) => row.id === custom.id)?.data, custom);
  assert.deepEqual(result.find((row) => row.id === parent.id)?.data, { ...parent, openings: position("fabricator").openings });
  assert.equal(result.find((row) => row.id === parent.id)?.status, "closed");
  for (const slug of ["fabricator-vertiv", "fabricator-novi-ferromont", "fabricator-ferokotao"]) {
    const added = result.find((row) => row.slug === slug)!;
    assert.equal(added.status, "closed", slug);
    assert.equal(added.data.status, "closed", slug);
  }
  assert.deepEqual((await db.select().from(applications).where(eq(applications.id, historical.id)))[0].data, historical);
  assert.deepEqual(await db.select().from(audits).where(eq(audits.id, "staff-audit-history")), auditsBefore);
  assert.equal(result.filter((row) => row.id !== custom.id).reduce((total, row) => total + (row.data.openings ?? 0), 0), 11100);
});

test("employer split leaves staff counts and renamed parent roles unchanged and inherits draft status", async () => {
  const db = await seedGroupedCatalog();
  const edited: Job = { ...grouped("fabricator"), openings: 901, status: "draft" };
  const renamed: Job = { ...grouped("cnc-operator"), slug: "staff-renamed-cnc", title: "Staff CNC program" };
  for (const job of [edited, renamed])
    await db.update(jobs).set({ slug: job.slug, status: job.status, data: job }).where(eq(jobs.id, job.id));
  await migrateEmployerPositions(db);
  const result = await db.select().from(jobs);
  assert.equal(result.length, 23);
  assert.deepEqual(result.find((row) => row.id === edited.id)?.data, edited);
  assert.deepEqual(result.find((row) => row.id === renamed.id)?.data, renamed);
  assert.equal(result.find((row) => row.slug === "cnc-operator-ferokotao")?.data.openings, position("cnc-operator-ferokotao").openings);
  for (const slug of ["fabricator-vertiv", "fabricator-novi-ferromont", "fabricator-ferokotao"]) {
    assert.equal(result.find((row) => row.slug === slug)?.status, "draft");
    assert.equal(result.find((row) => row.slug === slug)?.data.status, "draft");
  }
  const [event] = await db.select().from(audits).where(eq(audits.targetId, employerPositionsVersion));
  assert.deepEqual((event.details.preservedIds as string[]).sort(), [edited.id, renamed.id].sort());
});

test("custom employer-slug conflicts roll back every inserted row, count change and migration marker", async () => {
  const db = await seedGroupedCatalog();
  const conflict: Job = { ...grouped("cnc-operator"), id: "staff-slug-conflict", slug: "cnc-operator-ferokotao", openings: 37 };
  await db.insert(jobs).values({ id: conflict.id, slug: conflict.slug, status: conflict.status, data: conflict });
  const before = await db.select().from(jobs);
  await assert.rejects(migrateEmployerPositions(db));
  assert.deepEqual(await db.select().from(jobs), before);
  assert.equal((await db.select().from(settings).where(eq(settings.key, employerPositionsVersion))).length, 0);
  assert.equal((await db.select().from(audits).where(eq(audits.targetId, employerPositionsVersion))).length, 0);
  // Removing the deliberate conflict is confined to this synthetic database.
  await db.delete(jobs).where(eq(jobs.id, conflict.id));
  await migrateEmployerPositions(db);
  assert.equal((await db.select().from(jobs)).length, 23);
});

test("existing new-position IDs and later staff edits survive the split and subsequent initialization", async () => {
  const db = await seedGroupedCatalog();
  const existing: Job = {
    ...position("cnc-operator-ferokotao"), slug: "staff-renamed-ferokotao-cnc", title: "Reviewed CNC position",
    status: "closed", openings: 21, requirements: ["Staff CNC qualification"],
  };
  await db.insert(jobs).values({ id: existing.id, slug: existing.slug, status: existing.status, data: existing });
  await migrateProposedJobCatalog(db);
  assert.deepEqual((await db.select().from(jobs).where(eq(jobs.id, existing.id)))[0].data, existing);
  assert.equal((await db.select().from(jobs).where(eq(jobs.slug, "cnc-operator-ferokotao"))).length, 0);
  const fabricator = position("fabricator");
  const [row] = await db.select().from(jobs).where(eq(jobs.id, fabricator.id));
  const later = { ...row.data, openings: 777, description: "Edited after employer expansion" };
  await db.update(jobs).set({ data: later }).where(eq(jobs.id, row.id));
  await migrateProposedJobCatalog(db);
  assert.deepEqual((await db.select().from(jobs).where(eq(jobs.id, row.id)))[0].data, later);
  assert.equal((await db.select().from(jobs)).length, 23);
  assert.equal((await db.select().from(audits).where(eq(audits.targetId, employerPositionsVersion))).length, 1);
});
