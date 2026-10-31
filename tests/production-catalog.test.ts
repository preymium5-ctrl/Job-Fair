import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { combinedRoleRecruitmentJobs, proposedJobs } from "../data/jobs";
import { additionalApplicationJobs } from "../data/application-jobs";
import { jobOrderJobs } from "../data/job-orders";
import { closeDatabase, getDatabase } from "../lib/db";
import { getJobById, getJobs } from "../lib/repository";
import { jobs } from "../lib/schema";

test("an existing production catalog receives new roles without initial seeding or reopening staff-closed roles", async () => {
  const originalEnv = { ...process.env };
  const directory = await mkdtemp(path.join(tmpdir(), "chapter-production-catalog-"));
  try {
    Object.assign(process.env, { NODE_ENV: "test", CHAPTER_LOCAL_MODE: "true", DATA_DIR: directory });
    delete process.env.DATABASE_URL;
    delete process.env.SEED_PROPOSED_JOBS;
    delete process.env.SEED_EXAMPLE_JOBS;
    const db = await getDatabase();
    const grinder = combinedRoleRecruitmentJobs.find(({ slug }) => slug === "grinder-and-cleaner")!;
    const closedAdditional = { ...additionalApplicationJobs[0], title: "Staff-reviewed role", status: "closed" as const };
    await db.insert(jobs).values([grinder, closedAdditional].map((job) => ({ id: job.id, slug: job.slug, status: job.status, data: job })));

    // Reuse this test connection while exercising production initialization,
    // so no external PostgreSQL server or live recruitment data is involved.
    Object.assign(process.env, { NODE_ENV: "production", CHAPTER_LOCAL_MODE: "false" });
    const publicJobs = await getJobs();
    assert.deepEqual(publicJobs.map(({ title }) => title).sort(), ["Cleaner", "Grinder", ...additionalApplicationJobs.filter(({ id }) => id !== closedAdditional.id).map(({ title }) => title), ...jobOrderJobs.map(({ title }) => title)].sort());
    assert.equal(await getJobById(proposedJobs.find(({ slug }) => slug === "fabricator")!.id), undefined);
    assert.deepEqual(await getJobById(closedAdditional.id), closedAdditional);
    const applicationJobs = await getJobs({ includeApplicationOnly: true });
    assert.equal(applicationJobs.some(({ id }) => id === closedAdditional.id), false);
    assert.equal(applicationJobs.filter(({ id }) => id.startsWith("additional-")).length, additionalApplicationJobs.length - 1);
    assert.equal(applicationJobs.some(({ applicationOnly }) => applicationOnly), false);
  } finally {
    await closeDatabase();
    if (!path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(directory).startsWith("chapter-production-catalog-"))
      throw new Error("Unexpected production catalog test cleanup path.");
    await rm(directory, { recursive: true, force: true });
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
  }
});
