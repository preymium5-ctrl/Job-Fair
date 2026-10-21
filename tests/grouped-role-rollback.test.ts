import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { proposedJobs } from "../data/jobs";
import {
  filipinoWorkerImageVersion, groupedRoleRollbackVersion, hiringContentVersion,
  hiringWorkerCountsVersion, jobFairCatalogVersion, maximumAgeRequirementVersion,
  migrateGroupedRoleCatalog, migrateProposedJobCatalog, minimumExperienceVersion,
  proposalCatalogVersion,
} from "../lib/catalog-migration";
import { closeDatabase, getDatabase } from "../lib/db";
import { applications, audits, jobs, settings } from "../lib/schema";
import type { Application, Job } from "../lib/types";

let temporaryDirectory: string;
let scenario = 0;
const originalEnv = { ...process.env };
const expansionVersion = "employer-positions-pdf-2026-10-20-v1";
const priorVersions = [
  proposalCatalogVersion, jobFairCatalogVersion, filipinoWorkerImageVersion,
  hiringContentVersion, minimumExperienceVersion, hiringWorkerCountsVersion,
  maximumAgeRequirementVersion,
];
const splitCounts: Record<string, number> = {
  fabricator: 175, "mig-mag-tig-rel-welder": 275,
  "cnc-operator": 225, "industrial-spray-painter": 250,
};
const addedPositions = [
  ["fabricator", "fabricator-vertiv", 18, 225],
  ["fabricator", "fabricator-novi-ferromont", 19, 300],
  ["fabricator", "fabricator-ferokotao", 20, 450],
  ["mig-mag-tig-rel-welder", "mig-mag-tig-rel-welder-ferokotao", 21, 625],
  ["cnc-operator", "cnc-operator-ferokotao", 22, 475],
  ["industrial-spray-painter", "industrial-spray-painter-ferokotao", 23, 575],
] as const;

before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "chapter-grouped-rollback-test-"));
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
      !path.basename(temporaryDirectory).startsWith("chapter-grouped-rollback-test-"))
    throw new Error("Unexpected rollback test cleanup path.");
  await rm(temporaryDirectory, { recursive: true, force: true });
  for (const key of Object.keys(process.env))
    if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

function role(slug: string) {
  const job = proposedJobs.find((item) => item.slug === slug);
  assert.ok(job, `Expected original role ${slug}`);
  return job;
}
async function seedExpandedCatalog() {
  const db = await getDatabase();
  const expanded: Job[] = proposedJobs.map((job) => ({ ...job, openings: splitCounts[job.slug] ?? job.openings }));
  for (const [parent, slug, number, openings] of addedPositions)
    expanded.push({ ...role(parent), id: `proposed-${slug}-${number}`, slug, openings });
  for (const data of expanded)
    await db.insert(jobs).values({ id: data.id, slug: data.slug, status: data.status, data });
  for (const key of [...priorVersions, expansionVersion])
    await db.insert(settings).values({ key, value: "already applied" });
  return db;
}
function history(job: Job, suffix: string): Application {
  return {
    id: `rollback-history-${suffix}`, reference: `CH-ROLLBACK-${suffix}`, jobId: job.id,
    jobTitle: job.title, status: "Under Review", submittedAt: "2026-10-20T00:00:00.000Z",
    fullName: "Synthetic History", email: "history@example.test", phone: "+639171234567",
    country: "Philippines", recentJobTitle: "Fabricator", experienceYears: 5,
    skills: "Fabrication", education: "", summary: "", coverLetter: "", consent: true,
    referralSource: "Facebook", preferredEmployer: "Vertiv", resumeName: "synthetic.pdf",
    resumeKey: "resumes/synthetic-history.pdf", resumeMime: "application/pdf", isExample: true,
  };
}

test("fresh catalog includes a separate Cleaner and the updated 11,450 proposed slots", async () => {
  const db = await getDatabase();
  await migrateProposedJobCatalog(db);
  const rows = await db.select().from(jobs);
  assert.equal(rows.length, proposedJobs.length);
  assert.equal(rows.filter((row) => row.status === "published").length, proposedJobs.length);
  assert.equal(rows.reduce((total, row) => total + (row.data.openings ?? 0), 0), 11450);
  assert.equal(new Set(rows.map((row) => row.data.title)).size, proposedJobs.length);
  assert.deepEqual(rows.map((row) => row.id).sort(), proposedJobs.map((job) => job.id).sort());
  assert.equal((await db.select().from(settings).where(eq(settings.key, expansionVersion))).length, 0);
});

test("rollback retires six split listings, restores grouped totals and preserves applicant history", async () => {
  const db = await seedExpandedCatalog();
  const before = await db.select().from(jobs);
  const primary = before.find((row) => row.slug === "fabricator")!;
  const added = before.find((row) => row.slug === "fabricator-vertiv")!;
  for (const [row, suffix] of [[primary, "PRIMARY"], [added, "ADDED"]] as const) {
    const data = history(row.data, suffix);
    await db.insert(applications).values({ id: data.id, jobId: data.jobId, idempotencyKey: data.id, requestHash: "synthetic", data });
  }
  const applicationsBefore = await db.select().from(applications);
  await migrateProposedJobCatalog(db);
  const rows = await db.select().from(jobs);
  const published = rows.filter((row) => row.status === "published");
  assert.equal(rows.length, proposedJobs.length + 6, "Historical job records are retained");
  assert.equal(published.length, proposedJobs.length);
  assert.equal(published.reduce((total, row) => total + (row.data.openings ?? 0), 0), 11450);
  assert.deepEqual(await db.select().from(applications), applicationsBefore);
  for (const job of proposedJobs) {
    const current = rows.find((row) => row.id === job.id)!;
    assert.equal(current.slug, job.slug);
    assert.equal(current.data.openings, job.openings);
  }
  for (const [, slug] of addedPositions) {
    const current = rows.find((row) => row.slug === slug)!;
    const original = before.find((row) => row.id === current.id)!;
    assert.equal(current.status, "closed");
    assert.deepEqual(current.data, { ...original.data, status: "closed" });
  }
  const [event] = await db.select().from(audits).where(eq(audits.targetId, groupedRoleRollbackVersion));
  assert.equal(event.details.expansionApplied, true);
  assert.equal((event.details.retiredIds as string[]).length, 6);
  assert.equal((event.details.updatedIds as string[]).length, 4);
});

test("rollback preserves staff counts, renamed listings, closed roles and unrelated custom records", async () => {
  const db = await seedExpandedCatalog();
  const updates: Job[] = [
    { ...role("fabricator"), openings: 444, description: "Staff revised description" },
    { ...role("cnc-operator"), slug: "staff-renamed-cnc", openings: 225 },
    { ...role("industrial-spray-painter"), status: "closed", openings: 250 },
    { ...role("pipe-fitter"), id: "staff-custom", slug: "staff-custom", title: "Staff custom position", openings: 37 },
  ];
  for (const data of updates)
    await db.insert(jobs).values({ id: data.id, slug: data.slug, status: data.status, data })
      .onConflictDoUpdate({ target: jobs.id, set: { slug: data.slug, status: data.status, data } });
  const [added] = await db.select().from(jobs).where(eq(jobs.slug, "fabricator-vertiv"));
  const renamedAddition = { ...added.data, slug: "staff-renamed-employer-role", title: "Staff reviewed employer role" };
  await db.update(jobs).set({ slug: renamedAddition.slug, data: renamedAddition }).where(eq(jobs.id, added.id));
  await migrateProposedJobCatalog(db);
  const rows = await db.select().from(jobs);
  for (const data of [updates[0], updates[1], updates[3], renamedAddition])
    assert.deepEqual(rows.find((row) => row.id === data.id)?.data, data);
  const painter = rows.find((row) => row.id === role("industrial-spray-painter").id)!;
  assert.equal(painter.status, "closed", "Rollback must never reopen a staff-closed role");
  assert.equal(painter.data.status, "closed");
  assert.equal(painter.data.openings, 825);
});

test("rollback is idempotent and subsequent initialization preserves later staff changes", async () => {
  const db = await seedExpandedCatalog();
  await migrateGroupedRoleCatalog(db);
  const [row] = await db.select().from(jobs).where(eq(jobs.id, role("fabricator").id));
  const later = { ...row.data, openings: 777, description: "Edited after rollback" };
  await db.update(jobs).set({ data: later }).where(eq(jobs.id, row.id));
  const snapshot = await db.select().from(jobs);
  await migrateProposedJobCatalog(db);
  await migrateGroupedRoleCatalog(db);
  assert.deepEqual(await db.select().from(jobs), snapshot);
  assert.equal((await db.select().from(audits).where(eq(audits.targetId, groupedRoleRollbackVersion))).length, 1);
  assert.equal((await db.select().from(settings).where(eq(settings.key, groupedRoleRollbackVersion))).length, 1);
});
