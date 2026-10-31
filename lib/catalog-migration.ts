import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { proposedJobs, proposalV1Jobs, previousRecruitmentJobs, combinedRoleRecruitmentJobs, preExpansionRecruitmentJobs } from "../data/jobs";
import { additionalApplicationJobs, previousAdditionalApplicationJobs } from "../data/application-jobs";
import { jobOrderJobs } from "../data/job-orders";
import { getJobFairRole, jobFair } from "../data/job-fair";
import { maximumAgeRequirement, minimumExperienceRequirement } from "../data/employment";
import type { Database } from "./db";
import { audits, jobs, settings } from "./schema";
import { retiredEmployerPositions } from "./catalog-history";

export const proposalCatalogVersion = "proposed-net-jobs-v1";
export const jobFairCatalogVersion = "job-fair-pdf-2026-09-29-v2";
export const filipinoWorkerImageVersion = "filipino-worker-images-2026-10-16-v1";
export const hiringContentVersion = "croatia-philippines-hiring-2026-10-16-v1";
export const minimumExperienceVersion = "minimum-experience-three-years-2026-10-16-v1";
export const hiringWorkerCountsVersion = "employer-worker-counts-2026-10-16-v1";
export const maximumAgeRequirementVersion = "maximum-age-requirement-2026-10-16-v1";
export const groupedRoleRollbackVersion = "grouped-role-catalog-2026-10-20-v1";
export const separatedCleaningRolesVersion = "separate-grinder-cleaner-2026-10-20-v1";
export const publicApplicationCatalogVersion = "public-application-role-catalog-2026-10-21-v1";
export const jobOrderRolesVersion = "job-order-printing-press-operator-2026-10-31-v1";
const employerPositionsVersion = "employer-positions-pdf-2026-10-20-v1";
export const legacyExampleJobIds = [
  "example-warehouse-01",
  "example-bus-02",
  "example-auto-03",
  "example-carpenter-04",
  "example-construction-05",
  "example-production-06",
  "example-housekeeper-07",
  "example-butcher-08",
  "example-electrician-09",
  "example-welder-10",
  "example-bakery-11",
  "example-truck-12",
] as const;

/** Publish the operator's form-role proposals without altering staff edits or application links. */
export async function migratePublicApplicationCatalog(db: Database) {
  await db.transaction(async (tx) => {
    if (process.env.DATABASE_URL) await tx.execute(sql`SELECT pg_advisory_xact_lock(621349133)`);
    const [applied] = await tx.select().from(settings).where(eq(settings.key, publicApplicationCatalogVersion));
    if (applied) return;
    const existing = await tx.select().from(jobs).for("update");
    const byId = new Map(existing.map((row) => [row.id, row]));
    const bySlug = new Map(existing.map((row) => [row.slug, row]));
    const updatedIds: string[] = [];
    const addedIds: string[] = [];
    const preservedIds: string[] = [];
    const previousCatalog = [
      ...proposalV1Jobs, ...previousRecruitmentJobs, ...combinedRoleRecruitmentJobs,
      ...preExpansionRecruitmentJobs, ...previousAdditionalApplicationJobs,
    ];
    for (const replacement of [...proposedJobs, ...additionalApplicationJobs]) {
      const row = byId.get(replacement.id);
      if (!row) {
        // Only add the newly promoted form choices; a production catalog need
        // not enable or replay initial seeding of the older fair roles.
        if (!replacement.id.startsWith("additional-")) continue;
        const owner = bySlug.get(replacement.slug);
        if (owner) { preservedIds.push(owner.id); continue; }
        await tx.insert(jobs).values({ id: replacement.id, slug: replacement.slug, status: replacement.status, data: replacement });
        addedIds.push(replacement.id);
        continue;
      }
      if (row.slug !== replacement.slug || row.data.slug !== replacement.slug) {
        preservedIds.push(row.id);
        continue;
      }
      const baselines = previousCatalog.filter((job) => job.id === replacement.id);
      const data = { ...row.data };
      const fields = replacement.id.startsWith("additional-")
        ? ["category", "location", "summary", "description", "responsibilities", "requirements", "experience", "salary", "salaryStatus", "openings"] as const
        : ["salary", "salaryStatus", "openings", "location"] as const;
      for (const field of fields) {
        if (baselines.some((baseline) => JSON.stringify(data[field]) === JSON.stringify(baseline[field])))
          Object.assign(data, { [field]: replacement[field] });
      }
      // Update bundled imagery as a group; do not relabel a staff photo as male.
      if (data.image === replacement.image || baselines.some((baseline) => baseline.image === data.image)) {
        data.image = replacement.image;
        if (baselines.some((baseline) => baseline.imageAlt === data.imageAlt)) data.imageAlt = replacement.imageAlt;
        if (baselines.some((baseline) => baseline.imagePosition === data.imagePosition)) data.imagePosition = replacement.imagePosition;
      }
      if (replacement.id.startsWith("additional-") && data.applicationOnly === true &&
          baselines.some((baseline) => baseline.applicationOnly === true)) delete data.applicationOnly;
      // Both the database status and JSON status are deliberately retained.
      if (JSON.stringify(data) === JSON.stringify(row.data)) continue;
      await tx.update(jobs).set({ data }).where(eq(jobs.id, row.id));
      updatedIds.push(row.id);
    }
    await tx.insert(settings).values({ key: publicApplicationCatalogVersion, value: new Date().toISOString() });
    await tx.insert(audits).values({
      id: randomUUID(), actorId: "system:catalog-migration", action: "catalog.form-roles-published",
      targetId: publicApplicationCatalogVersion, details: { updatedIds, addedIds, preservedIds },
    });
  });
}

/** Publish roles from received job orders once, never replacing a staff record that owns the ID or URL. */
export async function migrateJobOrderRoles(db: Database) {
  await db.transaction(async (tx) => {
    if (process.env.DATABASE_URL) await tx.execute(sql`SELECT pg_advisory_xact_lock(621349133)`);
    const [applied] = await tx.select().from(settings).where(eq(settings.key, jobOrderRolesVersion));
    if (applied) return;
    const addedIds: string[] = [];
    const preservedIds: string[] = [];
    for (const job of jobOrderJobs) {
      const [byId] = await tx.select().from(jobs).where(eq(jobs.id, job.id));
      const [bySlug] = await tx.select().from(jobs).where(eq(jobs.slug, job.slug));
      if (byId || bySlug) { preservedIds.push((byId ?? bySlug)!.id); continue; }
      await tx.insert(jobs).values({ id: job.id, slug: job.slug, status: job.status, data: job });
      addedIds.push(job.id);
    }
    await tx.insert(settings).values({ key: jobOrderRolesVersion, value: new Date().toISOString() });
    await tx.insert(audits).values({
      id: randomUUID(), actorId: "system:catalog-migration", action: "catalog.job-order-roles-published",
      targetId: jobOrderRolesVersion, details: { addedIds, preservedIds },
    });
  });
}

/** Apply the operator's catalog replacement once without deleting historical records. */
export async function migrateProposedJobCatalog(db: Database) {
  await db.transaction(async (tx) => {
    if (process.env.DATABASE_URL)
      await tx.execute(sql`SELECT pg_advisory_xact_lock(621349133)`);
    const [seeded] = await tx
      .select()
      .from(settings)
      .where(eq(settings.key, proposalCatalogVersion));
    if (seeded) return;

    const retiredIds: string[] = [];
    for (const id of legacyExampleJobIds) {
      const [previous] = await tx.select().from(jobs).where(eq(jobs.id, id));
      if (!previous) continue;
      // Keep the primary key so applications and audits retain their linkage.
      // Archived slugs also release "welder" for the new proposed role.
      const slug = `legacy-${id}`;
      const data = { ...previous.data, slug, status: "closed" as const };
      await tx
        .update(jobs)
        .set({ slug, status: "closed", data })
        .where(eq(jobs.id, id));
      retiredIds.push(id);
    }

    // A custom staff record with a requested slug must never be overwritten.
    // Unique-key conflicts roll back the entire replacement for staff review.
    for (const job of proposedJobs)
      await tx.insert(jobs).values({
        id: job.id,
        slug: job.slug,
        status: job.status,
        data: job,
      });
    await tx.insert(settings).values({
      key: proposalCatalogVersion,
      value: new Date().toISOString(),
    });
    await tx.insert(audits).values({
      id: randomUUID(),
      actorId: "system:catalog-migration",
      action: "catalog.replaced",
      targetId: proposalCatalogVersion,
      details: {
        retiredIds,
        addedIds: proposedJobs.map((job) => job.id),
        proposedWorkers: proposedJobs.reduce((total, job) => total + (job.openings ?? 0), 0),
      },
    });
  });
  await migrateJobFairCatalog(db);
  await migrateFilipinoWorkerImages(db);
  await migrateHiringContent(db);
  await migrateMinimumExperience(db);
  await migrateHiringWorkerCounts(db);
  await migrateMaximumAgeRequirement(db);
  await migrateGroupedRoleCatalog(db);
  await migrateSeparatedCleaningRoles(db);
}

/** Split the public role while preserving its primary key, counts, and applicant history. */
export async function migrateSeparatedCleaningRoles(db: Database) {
  await db.transaction(async (tx) => {
    if (process.env.DATABASE_URL) await tx.execute(sql`SELECT pg_advisory_xact_lock(621349133)`);
    const [applied] = await tx.select().from(settings).where(eq(settings.key, separatedCleaningRolesVersion));
    if (applied) return;
    const updatedIds: string[] = [];
    const addedIds: string[] = [];
    const preservedIds: string[] = [];
    const baseline = combinedRoleRecruitmentJobs.find((job) => job.slug === "grinder-and-cleaner")!;
    const grinder = proposedJobs.find((job) => job.id === baseline.id)!;
    const cleaner = proposedJobs.find((job) => job.slug === "cleaner")!;
    const [row] = await tx.select().from(jobs).where(eq(jobs.id, grinder.id)).for("update");
    if (row && row.slug === grinder.slug && row.data.slug === grinder.slug) {
      const data = { ...row.data };
      for (const field of ["title", "summary", "description", "responsibilities", "imageAlt"] as const) {
        if (JSON.stringify(data[field]) === JSON.stringify(baseline[field]))
          Object.assign(data, { [field]: grinder[field] });
      }
      if (JSON.stringify(data) !== JSON.stringify(row.data)) {
        await tx.update(jobs).set({ data }).where(eq(jobs.id, row.id));
        updatedIds.push(row.id);
      }
    }
    const [existingCleaner] = await tx.select().from(jobs).where(eq(jobs.id, cleaner.id));
    const [cleanerSlugOwner] = await tx.select().from(jobs).where(eq(jobs.slug, cleaner.slug));
    if (!existingCleaner && !cleanerSlugOwner) {
      await tx.insert(jobs).values({ id: cleaner.id, slug: cleaner.slug, status: cleaner.status, data: cleaner });
      addedIds.push(cleaner.id);
    } else if (existingCleaner?.id !== cleanerSlugOwner?.id || existingCleaner?.slug !== cleaner.slug) {
      // An existing staff record owns this ID or URL; retain it for staff review.
      preservedIds.push(existingCleaner?.id ?? cleanerSlugOwner!.id);
    }
    await tx.insert(settings).values({ key: separatedCleaningRolesVersion, value: new Date().toISOString() });
    await tx.insert(audits).values({
      id: randomUUID(), actorId: "system:catalog-migration", action: "catalog.cleaning-roles-separated",
      targetId: separatedCleaningRolesVersion, details: { updatedIds, addedIds, preservedIds },
    });
  });
}

/** Undo the employer split once, retaining applications and any subsequent staff edits. */
export async function migrateGroupedRoleCatalog(db: Database) {
  await db.transaction(async (tx) => {
    if (process.env.DATABASE_URL)
      await tx.execute(sql`SELECT pg_advisory_xact_lock(621349133)`);
    const [applied] = await tx.select().from(settings).where(eq(settings.key, groupedRoleRollbackVersion));
    if (applied) return;
    const [expanded] = await tx.select().from(settings).where(eq(settings.key, employerPositionsVersion));
    const retiredIds: string[] = [];
    const updatedIds: string[] = [];
    const preservedIds: string[] = [];

    if (expanded) {
      // These are the six canonical records introduced by the reverted split.
      // Keep their IDs, slugs and contents for historical applications; only
      // published rows still using their canonical slugs need to be retired.
      for (const { id, slug } of retiredEmployerPositions) {
        const [row] = await tx.select().from(jobs).where(eq(jobs.id, id)).for("update");
        if (!row) continue;
        if (row.slug !== slug || row.data.slug !== slug) {
          preservedIds.push(row.id);
          continue;
        }
        if (row.status !== "published") continue;
        await tx.update(jobs).set({ status: "closed", data: { ...row.data, status: "closed" } }).where(eq(jobs.id, row.id));
        retiredIds.push(row.id);
      }

      // Restore grouped totals only where the split count is unchanged.
      // Staff-edited counts, renamed rows and all statuses remain untouched.
      const splitCounts: Record<string, number> = {
        fabricator: 175,
        "mig-mag-tig-rel-welder": 275,
        "cnc-operator": 225,
        "industrial-spray-painter": 250,
      };
      for (const replacement of proposedJobs) {
        const splitCount = splitCounts[replacement.slug];
        if (splitCount === undefined) continue;
        const [row] = await tx.select().from(jobs).where(eq(jobs.id, replacement.id)).for("update");
        if (!row) continue;
        if (row.slug !== replacement.slug || row.data.slug !== replacement.slug || row.data.openings !== splitCount) {
          preservedIds.push(row.id);
          continue;
        }
        await tx.update(jobs).set({ data: { ...row.data, openings: replacement.openings } }).where(eq(jobs.id, row.id));
        updatedIds.push(row.id);
      }
    }

    await tx.insert(settings).values({ key: groupedRoleRollbackVersion, value: new Date().toISOString() });
    await tx.insert(audits).values({
      id: randomUUID(), actorId: "system:catalog-migration", action: "catalog.grouped-roles-restored",
      targetId: groupedRoleRollbackVersion,
      details: { expansionApplied: Boolean(expanded), retiredIds, updatedIds, preservedIds, catalogRoles: proposedJobs.length },
    });
  });
}

/** Add the recruitment requirement without altering staff content or historical applicant records. */
export async function migrateMaximumAgeRequirement(db: Database) {
  await db.transaction(async (tx) => {
    if (process.env.DATABASE_URL) await tx.execute(sql`SELECT pg_advisory_xact_lock(621349133)`);
    const [applied] = await tx.select().from(settings).where(eq(settings.key, maximumAgeRequirementVersion));
    if (applied) return;
    const updatedIds: string[] = [];
    for (const replacement of proposedJobs) {
      const [row] = await tx.select().from(jobs).where(eq(jobs.id, replacement.id)).for("update");
      if (!row || row.slug !== replacement.slug || row.data.requirements.includes(maximumAgeRequirement)) continue;
      await tx.update(jobs).set({ data: { ...row.data, requirements: [maximumAgeRequirement, ...row.data.requirements] } }).where(eq(jobs.id, row.id));
      updatedIds.push(row.id);
    }
    await tx.insert(settings).values({ key: maximumAgeRequirementVersion, value: new Date().toISOString() });
    await tx.insert(audits).values({ id: randomUUID(), actorId: "system:catalog-migration", action: "catalog.age-requirement-added", targetId: maximumAgeRequirementVersion, details: { updatedIds, fields: ["requirements"] } });
  });
}

/** Apply the owner's new counts only to matching catalog roles; retain all other fields and applicant history. */
export async function migrateHiringWorkerCounts(db: Database) {
  await db.transaction(async (tx) => {
    if (process.env.DATABASE_URL) await tx.execute(sql`SELECT pg_advisory_xact_lock(621349133)`);
    const [applied] = await tx.select().from(settings).where(eq(settings.key, hiringWorkerCountsVersion));
    if (applied) return;
    const updatedIds: string[] = [];
    for (const replacement of proposedJobs) {
      const [row] = await tx.select().from(jobs).where(eq(jobs.id, replacement.id)).for("update");
      if (!row || row.slug !== replacement.slug || row.data.openings === replacement.openings) continue;
      await tx.update(jobs).set({ data: { ...row.data, openings: replacement.openings } }).where(eq(jobs.id, row.id));
      updatedIds.push(row.id);
    }
    await tx.insert(settings).values({ key: hiringWorkerCountsVersion, value: new Date().toISOString() });
    await tx.insert(audits).values({ id: randomUUID(), actorId: "system:catalog-migration", action: "catalog.worker-counts-updated", targetId: hiringWorkerCountsVersion, details: { updatedIds, fields: ["openings"] } });
  });
}

export async function migrateMinimumExperience(db: Database) {
  await db.transaction(async (tx) => {
    if (process.env.DATABASE_URL) await tx.execute(sql`SELECT pg_advisory_xact_lock(621349133)`);
    const [applied] = await tx.select().from(settings).where(eq(settings.key, minimumExperienceVersion));
    if (applied) return;
    const updatedIds: string[] = [];
    for (const replacement of proposedJobs) {
      const [row] = await tx.select().from(jobs).where(eq(jobs.id, replacement.id)).for("update");
      if (!row || row.slug !== replacement.slug) continue;
      const baseline = proposalV1Jobs.find((job) => job.id === row.id);
      const data = { ...row.data, requirements: [...new Set([minimumExperienceRequirement, ...row.data.requirements])] };
      if (data.experience === baseline?.experience) data.experience = replacement.experience;
      if (JSON.stringify(data) === JSON.stringify(row.data)) continue;
      await tx.update(jobs).set({ data }).where(eq(jobs.id, row.id));
      updatedIds.push(row.id);
    }
    await tx.insert(settings).values({ key: minimumExperienceVersion, value: new Date().toISOString() });
    await tx.insert(audits).values({ id: randomUUID(), actorId: "system:catalog-migration", action: "catalog.minimum-experience-updated", targetId: minimumExperienceVersion, details: { updatedIds } });
  });
}

/** Update original recruitment copy and benefits while retaining staff edits and applications. */
export async function migrateHiringContent(db: Database) {
  await db.transaction(async (tx) => {
    if (process.env.DATABASE_URL)
      await tx.execute(sql`SELECT pg_advisory_xact_lock(621349133)`);
    const [applied] = await tx.select().from(settings).where(eq(settings.key, hiringContentVersion));
    if (applied) return;
    const updatedIds: string[] = [];
    for (const replacement of proposedJobs) {
      const [row] = await tx.select().from(jobs).where(eq(jobs.id, replacement.id)).for("update");
      if (!row || row.slug !== replacement.slug) continue;
      const baselines = [...proposalV1Jobs, ...previousRecruitmentJobs].filter((job) => job.id === row.id);
      const data = { ...row.data };
      if (baselines.some((job) => job.description === data.description)) data.description = replacement.description;
      if (baselines.some((job) => JSON.stringify(job.requirements) === JSON.stringify(data.requirements))) data.requirements = replacement.requirements;
      if (baselines.some((job) => job.location === data.location)) data.location = replacement.location;
      data.benefits = [...new Set([...replacement.benefits, ...data.benefits])];
      if (JSON.stringify(data) === JSON.stringify(row.data)) continue;
      await tx.update(jobs).set({ data }).where(eq(jobs.id, row.id));
      updatedIds.push(row.id);
    }
    await tx.insert(settings).values({ key: hiringContentVersion, value: new Date().toISOString() });
    await tx.insert(audits).values({
      id: randomUUID(), actorId: "system:catalog-migration", action: "catalog.hiring-content-refreshed",
      targetId: hiringContentVersion, details: { updatedIds, fields: ["description", "requirements", "location", "benefits"] },
    });
  });
}

/** Refresh original role imagery without changing staff photos or recruitment data. */
export async function migrateFilipinoWorkerImages(db: Database) {
  await db.transaction(async (tx) => {
    if (process.env.DATABASE_URL)
      await tx.execute(sql`SELECT pg_advisory_xact_lock(621349133)`);
    const [applied] = await tx.select().from(settings).where(eq(settings.key, filipinoWorkerImageVersion));
    if (applied) return;
    const updatedIds: string[] = [];
    for (const replacement of proposedJobs) {
      const [row] = await tx.select().from(jobs).where(eq(jobs.id, replacement.id)).for("update");
      const originalImage = `/images/jobs/proposed/${replacement.slug}.webp`;
      if (!row || row.slug !== replacement.slug || row.data.image !== originalImage) continue;
      await tx.update(jobs).set({ data: {
        ...row.data, image: replacement.image, imageAlt: replacement.imageAlt,
      } }).where(eq(jobs.id, row.id));
      updatedIds.push(row.id);
    }
    await tx.insert(settings).values({ key: filipinoWorkerImageVersion, value: new Date().toISOString() });
    await tx.insert(audits).values({
      id: randomUUID(), actorId: "system:catalog-migration", action: "catalog.images-refreshed",
      targetId: filipinoWorkerImageVersion,
      details: { updatedIds, fields: ["image", "imageAlt"] },
    });
  });
}

/** Enrich only untouched seed fields; keep staff edits and all historical links. */
export async function migrateJobFairCatalog(db: Database) {
  await db.transaction(async (tx) => {
    if (process.env.DATABASE_URL)
      await tx.execute(sql`SELECT pg_advisory_xact_lock(621349133)`);
    const [applied] = await tx.select().from(settings).where(eq(settings.key, jobFairCatalogVersion));
    if (applied) return;
    const updatedIds: string[] = [];
    for (const baseline of proposalV1Jobs) {
      const replacement = proposedJobs.find((job) => job.id === baseline.id)!;
      const [row] = await tx.select().from(jobs).where(eq(jobs.id, baseline.id)).for("update");
      if (!row || row.slug !== baseline.slug || !getJobFairRole(row.data)) continue;
      const data = { ...row.data };
      let changed = false;
      if (row.data.description === baseline.description) {
        data.description = replacement.description;
        changed = true;
      }
      if (JSON.stringify(row.data.requirements) === JSON.stringify(baseline.requirements)) {
        data.requirements = replacement.requirements;
        changed = true;
      }
      if (changed) {
        await tx.update(jobs).set({ data }).where(eq(jobs.id, row.id));
        updatedIds.push(row.id);
      }
    }
    await tx.insert(settings).values({ key: jobFairCatalogVersion, value: new Date().toISOString() });
    await tx.insert(audits).values({
      id: randomUUID(), actorId: "system:catalog-migration", action: "catalog.enriched",
      targetId: jobFairCatalogVersion,
      details: { sourceDate: jobFair.sourceDate, updatedIds, fields: ["description", "requirements"] },
    });
  });
}
