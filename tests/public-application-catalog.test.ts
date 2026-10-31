import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { additionalApplicationJobs, previousAdditionalApplicationJobs, publishedCatalogJobs } from "../data/application-jobs";
import { preExpansionRecruitmentJobs, proposedJobs } from "../data/jobs";
import { hiringWorkerTotal } from "../data/hiring-allocations";
import { migratePublicApplicationCatalog, publicApplicationCatalogVersion } from "../lib/catalog-migration";
import { closeDatabase, getDatabase } from "../lib/db";
import { applications, audits, jobs } from "../lib/schema";
import type { Application, Job } from "../lib/types";
import { jobSchema } from "../lib/validation";

const originalEnv = { ...process.env };
let directory: string;
let scenario = 0;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "chapter-public-application-catalog-"));
  Object.assign(process.env, { NODE_ENV: "test", CHAPTER_LOCAL_MODE: "true" });
  delete process.env.DATABASE_URL;
});
beforeEach(async () => {
  await closeDatabase();
  process.env.DATA_DIR = path.join(directory, String(++scenario));
});
after(async () => {
  await closeDatabase();
  if (!path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep) ||
      !path.basename(directory).startsWith("chapter-public-application-catalog-"))
    throw new Error("Unexpected public application catalog test cleanup path.");
  await rm(directory, { recursive: true, force: true });
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

async function insert(data: Job) {
  const db = await getDatabase();
  await db.insert(jobs).values({ id: data.id, slug: data.slug, status: data.status, data });
  return db;
}

test("118 public proposals keep distinct IDs and valid structured job data without attaching new employers", () => {
  assert.equal(publishedCatalogJobs.length, 118);
  assert.equal(new Set(publishedCatalogJobs.map(({ id }) => id)).size, 118);
  assert.equal(new Set(publishedCatalogJobs.map(({ slug }) => slug)).size, 118);
  for (const job of publishedCatalogJobs) assert.equal(jobSchema.safeParse(job).success, true, job.title);
  for (const job of additionalApplicationJobs) {
    assert.match(job.description, /operator-supplied proposals/);
    assert.equal(hiringWorkerTotal(job.slug), undefined, job.title);
    assert.deepEqual(job.benefits, [], job.title);
    assert.equal(job.requirements.some((item) => /male|female|years old|minimum 3/i.test(item)), false, job.title);
  }
});

test("deployed form choices become public while staff edits, closures, and application history survive", async () => {
  const original = previousAdditionalApplicationJobs[0];
  const db = await insert(original);
  const closedOriginal = previousAdditionalApplicationJobs[1];
  const closed = { ...closedOriginal, title: "Staff-reviewed title", status: "closed" as const,
    salary: "€1,111", openings: 42, image: "/images/staff-photo.webp", location: "Staff location", requirements: ["Staff requirement"] };
  await insert(closed);
  const existingFair = preExpansionRecruitmentJobs.find(({ slug }) => slug === "grinder-and-cleaner")!;
  await insert(existingFair);
  const staffFair = { ...preExpansionRecruitmentJobs[0], salary: "€1,111", openings: 45, image: "/images/staff-fabricator.webp", status: "closed" as const };
  await insert(staffFair);
  const custom = { ...additionalApplicationJobs[2], id: "staff-custom", slug: "staff-custom", salary: "€999", openings: 11 };
  await insert(custom);
  const history: Application = {
    id: "promotion-history", reference: "CH-PROMOTION-HISTORY", jobId: original.id, jobTitle: original.title,
    status: "Under Review", submittedAt: "2026-10-20T00:00:00.000Z", fullName: "Synthetic History",
    email: "history@example.test", phone: "+639171234567", country: "Philippines", recentJobTitle: original.title,
    experienceYears: 3, skills: "Service", education: "", summary: "", coverLetter: "", consent: true,
    resumeName: "synthetic.pdf", resumeKey: "resumes/synthetic.pdf", resumeMime: "application/pdf", isExample: true,
  };
  await db.insert(applications).values({ id: history.id, jobId: history.jobId, idempotencyKey: history.id, requestHash: "synthetic", data: history });
  await migratePublicApplicationCatalog(db);
  const result = await db.select().from(jobs);
  const promoted = result.find(({ id }) => id === original.id)!;
  assert.deepEqual(promoted.data, additionalApplicationJobs.find(({ id }) => id === original.id));
  const retained = result.find(({ id }) => id === closed.id)!;
  assert.equal(retained.status, "closed");
  for (const field of ["title", "status", "salary", "openings", "image", "location", "requirements"] as const)
    assert.deepEqual(retained.data[field], closed[field], field);
  assert.equal(retained.data.applicationOnly, undefined);
  const refreshedFair = result.find(({ id }) => id === existingFair.id)!.data;
  assert.equal(refreshedFair.salary, "€850–€950");
  assert.equal(refreshedFair.openings, 250);
  assert.equal(refreshedFair.image, proposedJobs.find(({ id }) => id === existingFair.id)!.image);
  assert.equal(hiringWorkerTotal(existingFair.slug), 150);
  const retainedFair = result.find(({ id }) => id === staffFair.id)!.data;
  assert.equal(retainedFair.salary, staffFair.salary);
  assert.equal(retainedFair.openings, staffFair.openings);
  assert.equal(retainedFair.image, staffFair.image);
  assert.equal(retainedFair.imageAlt, staffFair.imageAlt);
  assert.equal(retainedFair.status, "closed");
  assert.deepEqual(result.find(({ id }) => id === custom.id)!.data, custom);
  assert.deepEqual((await db.select().from(applications))[0].data, history);
  assert.equal(result.filter(({ id }) => id.startsWith("additional-")).length, 99);
  const later = { ...promoted.data, salary: "€1,234", openings: 321 };
  await db.update(jobs).set({ data: later }).where(eq(jobs.id, original.id));
  await migratePublicApplicationCatalog(db);
  assert.deepEqual((await db.select().from(jobs).where(eq(jobs.id, original.id)))[0].data, later);
  assert.equal((await db.select().from(audits).where(eq(audits.targetId, publicApplicationCatalogVersion))).length, 1);
});

test("new role insertion preserves staff-owned URLs and never seeds missing fair jobs in production", async () => {
  const target = additionalApplicationJobs.find(({ title }) => title === "Hair Transplant Nurse")!;
  const owner = { ...target, id: "staff-url-owner", title: "Staff-owned URL", openings: 17 };
  const db = await insert(owner);
  const renamedOriginal = { ...previousAdditionalApplicationJobs[0], slug: "staff-renamed-role", summary: "Staff copy" };
  await insert(renamedOriginal);
  await migratePublicApplicationCatalog(db);
  const rows = await db.select().from(jobs);
  assert.deepEqual(rows.find(({ id }) => id === owner.id)?.data, owner);
  assert.equal(rows.some(({ id }) => id === target.id), false);
  assert.deepEqual(rows.find(({ id }) => id === renamedOriginal.id)?.data, renamedOriginal);
  assert.equal(rows.some(({ id }) => id.startsWith("proposed-")), false);
});
