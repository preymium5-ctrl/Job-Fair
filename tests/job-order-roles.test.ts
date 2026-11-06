import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { after, before, beforeEach, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { publishedCatalogJobs } from "../data/application-jobs";
import { jobOrderJobs, printingPressOperatorJob, retiredApplicationRoles, trailerDriverJob } from "../data/job-orders";
import { additionalApplicationJobOptions, additionalApplicationJobs } from "../data/application-jobs";
import { getPublicJobs } from "../lib/public-jobs";
import { getRequiredProfileDocumentCategories } from "../lib/document-uploads";
import { jobOrderRolesVersion, migrateJobOrderRoles } from "../lib/catalog-migration";
import { closeDatabase, getDatabase } from "../lib/db";
import { jobs, settings } from "../lib/schema";
import { jobSchema } from "../lib/validation";

const originalEnv = { ...process.env };
let directory: string;
let scenario = 0;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "chapter-job-order-roles-"));
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
      !path.basename(directory).startsWith("chapter-job-order-roles-"))
    throw new Error("Unexpected job order test cleanup path.");
  await rm(directory, { recursive: true, force: true });
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

test("the printing press operator job order is published with the supplied salary and positions", () => {
  const job = printingPressOperatorJob;
  assert.equal(jobSchema.safeParse(job).success, true);
  assert.equal(job.salary, "€850–€1,000");
  assert.equal(job.salaryStatus, "proposed-net");
  assert.equal(job.openings, 6);
  assert.equal(job.location, "Croatia");
  assert.equal(publishedCatalogJobs.filter(({ slug }) => slug === job.slug).length, 1);
});

test("the trailer driver job order shows the supplied salary and experience and requires a license", () => {
  const job = trailerDriverJob;
  assert.equal(jobSchema.safeParse(job).success, true);
  assert.equal(job.salary, "€2,000");
  assert.equal(job.salaryStatus, "proposed-net");
  assert.match(job.experience, /5–10 years/);
  assert.equal(job.openings, 50);
  assert.ok(getRequiredProfileDocumentCategories(job.title).includes("driver-license"));
  assert.equal(publishedCatalogJobs.filter(({ slug }) => slug === job.slug).length, 1);
});

test("job order roles are added once and never replace a staff record", async () => {
  const db = await getDatabase();
  const staff = { ...printingPressOperatorJob, title: "Staff title", salary: "€1,111" };
  await db.insert(jobs).values({ id: staff.id, slug: staff.slug, status: staff.status, data: staff });
  await migrateJobOrderRoles(db);
  const [row] = await db.select().from(jobs);
  assert.equal(row.data.title, "Staff title");
  assert.ok((await db.select().from(settings)).some(({ key }) => key === jobOrderRolesVersion));
});

test("job order roles are inserted into an existing catalog", async () => {
  const db = await getDatabase();
  await migrateJobOrderRoles(db);
  await migrateJobOrderRoles(db);
  const rows = await db.select().from(jobs);
  assert.deepEqual(rows.map(({ id }) => id).sort(), jobOrderJobs.map(({ id }) => id).sort());
  assert.equal(rows.find(({ id }) => id === trailerDriverJob.id)?.data.salary, "€2,000");
});

test("the old Trailer Truck Driver role is closed in the bundled catalog without shifting other roles", async () => {
  const old = additionalApplicationJobs.find(({ title }) => title === "Trailer Truck Driver")!;
  assert.equal(old.id, retiredApplicationRoles[0].id);
  assert.equal(old.status, "closed");
  assert.equal(additionalApplicationJobs.filter(({ status }) => status === "closed").length, 1);
  assert.equal(additionalApplicationJobOptions.some(({ id }) => id === old.id), false);
  const previous = { ...process.env };
  try {
    // Exercise the database-free public catalog used by the production fair guide.
    Object.assign(process.env, { NODE_ENV: "production", CHAPTER_LOCAL_MODE: "false" });
    delete process.env.DATABASE_URL;
    const titles = (await getPublicJobs()).map(({ title }) => title);
    assert.equal(titles.includes("Trailer Truck Driver"), false);
    assert.equal(titles.filter((title) => title === "Trailer Driver").length, 1);
  } finally {
    Object.assign(process.env, previous);
  }
});

test("an existing published Trailer Truck Driver row is closed by the job order migration", async () => {
  const db = await getDatabase();
  const old = additionalApplicationJobs.find(({ id }) => id === retiredApplicationRoles[0].id)!;
  await db.insert(jobs).values({ id: old.id, slug: old.slug, status: "published", data: { ...old, status: "published" } });
  await migrateJobOrderRoles(db);
  const [row] = await db.select().from(jobs).where(eq(jobs.id, old.id));
  assert.equal(row.status, "closed");
  assert.equal(row.data.status, "closed");
  assert.equal(row.slug, old.slug);
});

test("a staff-renamed Trailer Truck Driver row is not closed", async () => {
  const db = await getDatabase();
  const old = additionalApplicationJobs.find(({ id }) => id === retiredApplicationRoles[0].id)!;
  await db.insert(jobs).values({ id: old.id, slug: "staff-trailer", status: "published", data: { ...old, slug: "staff-trailer", status: "published" } });
  await migrateJobOrderRoles(db);
  const [row] = await db.select().from(jobs).where(eq(jobs.id, old.id));
  assert.equal(row.status, "published");
});
