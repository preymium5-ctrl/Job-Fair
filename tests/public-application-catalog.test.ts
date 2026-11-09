import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { addedApplicationJobsV1, additionalApplicationJobs, previousAdditionalApplicationJobs, publishedCatalogJobs } from "../data/application-jobs";
import { preExpansionRecruitmentJobs, proposedJobs } from "../data/jobs";
import { hiringWorkerTotal } from "../data/hiring-allocations";
import { addedApplicationRolesVersion, migrateAddedApplicationRoles, migratePublicApplicationCatalog, publicApplicationCatalogVersion } from "../lib/catalog-migration";
import { closeDatabase, getDatabase } from "../lib/db";
import { applications, audits, jobs, settings } from "../lib/schema";
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

test("121 public proposals keep distinct IDs and valid structured job data without attaching new employers", () => {
  assert.equal(publishedCatalogJobs.length, 121);
  assert.equal(new Set(publishedCatalogJobs.map(({ id }) => id)).size, 121);
  assert.equal(new Set(publishedCatalogJobs.map(({ slug }) => slug)).size, 121);
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
  assert.equal(result.filter(({ id }) => id.startsWith("additional-")).length, 101);
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

test("roles added on 9 November 2026 reach a catalog that was already published, once", async () => {
  const db = await getDatabase();
  // A production catalog that ran the original publication before these roles existed.
  await db.insert(settings).values({ key: publicApplicationCatalogVersion, value: "2026-10-21T00:00:00.000Z" });
  const shuttering = additionalApplicationJobs.find(({ title }) => title === "Shuttering Carpenter")!;
  const owner = { ...shuttering, id: "staff-shuttering", title: "Staff shuttering role", openings: 5 };
  await insert(owner);
  await migratePublicApplicationCatalog(db);
  await migrateAddedApplicationRoles(db);
  await migrateAddedApplicationRoles(db);
  const rows = await db.select().from(jobs);
  const steelman = rows.find(({ id }) => id === "additional-steelfixer-steelman");
  assert.equal(steelman?.slug, "additional-steelfixer-steelman");
  assert.equal(steelman?.status, "published");
  assert.equal(steelman?.data.title, "SteelFixer | Steelman");
  assert.equal(steelman?.data.category, "Construction & Building Trades");
  assert.equal(steelman?.data.location, "Croatia");
  assert.deepEqual(rows.find(({ id }) => id === owner.id)?.data, owner);
  assert.equal(rows.some(({ id }) => id === shuttering.id), false);
  const [audit, ...extra] = await db.select().from(audits).where(eq(audits.targetId, addedApplicationRolesVersion));
  assert.equal(extra.length, 0);
  assert.deepEqual(audit.details, { addedIds: ["additional-steelfixer-steelman"], updatedIds: [], preservedIds: [owner.id] });
});

test("roles first seeded with rotated destinations move to Croatia unless staff edited the field", async () => {
  const [steelmanV1, shutteringV1] = ["SteelFixer | Steelman", "Shuttering Carpenter"]
    .map((title) => addedApplicationJobsV1.find((job) => job.title === title)!);
  assert.equal(steelmanV1.location, "Romania");
  assert.equal(shutteringV1.location, "Macedonia");
  const edited = { ...shutteringV1, location: "Slovenia" };
  await insert(steelmanV1);
  const db = await insert(edited);
  await migrateAddedApplicationRoles(db);
  const rows = await db.select().from(jobs);
  const steelman = rows.find(({ id }) => id === steelmanV1.id)!.data;
  assert.equal(steelman.location, "Croatia");
  assert.match(steelman.description, /Apply for SteelFixer \| Steelman in Croatia\./);
  const shuttering = rows.find(({ id }) => id === shutteringV1.id)!.data;
  assert.equal(shuttering.location, "Slovenia");
  assert.match(shuttering.description, /in Croatia\./);
  const [audit] = await db.select().from(audits).where(eq(audits.targetId, addedApplicationRolesVersion));
  assert.deepEqual(audit.details, { addedIds: [], updatedIds: [steelmanV1.id, shutteringV1.id], preservedIds: [] });
});
