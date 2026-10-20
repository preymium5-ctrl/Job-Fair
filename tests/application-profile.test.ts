import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { closeDatabase } from "../lib/db";
import { getApplications, getJobById, getJobBySlug, getJobs, saveJob } from "../lib/repository";
import { applicationSchema } from "../lib/validation";
import type { ApplicationProfile } from "../lib/types";
import { readObject } from "../lib/storage";
import { drainSheetsQueue } from "../lib/sheets-queue";
import { POST as submit } from "../app/api/applications/route";
import { destinationCountries } from "../data/application-form-options";
import { additionalApplicationJobs } from "../data/application-jobs";
import { getRequiredProfileDocumentCategories, isDriverPosition } from "../lib/document-uploads";

const original = { ...process.env };
const origin = "http://localhost:3000";
const pdf = Buffer.from("%PDF-1.4\nSynthetic profile document\n%%EOF\n");
let directory = "";
const profile: ApplicationProfile = {
  firstName: "Test", lastName: "Applicant", gender: "Female", nationality: "Filipino",
  address: "123 Sample Street", dateOfBirth: "1994-02-28", placeOfBirth: "Manila",
  destinationCountry: "Croatia", currentWorkCountry: "Philippines", secondaryJobTitle: "Welder",
  englishProficiency: "No", termsAccepted: true, telegram: "@synthetic", fatherName: "Sample Father",
  motherName: "Sample Mother", otherJobTitle: "Fabricator",
};
function input(jobId = "test") {
  return { jobId, fullName: "Test Applicant", email: "profile@example.test", phone: "+639171234567",
    country: "Philippines", recentJobTitle: "Fabricator", experienceYears: 3, skills: "Fabrication",
    education: "", summary: "", coverLetter: "", consent: true, profile };
}
function referenceInput(jobId = "test") {
  const { country: _country, recentJobTitle: _recent, experienceYears: _years, skills: _skills,
    education: _education, summary: _summary, coverLetter: _cover, ...reference } = input(jobId);
  void _country; void _recent; void _years; void _skills; void _education; void _summary; void _cover;
  return reference;
}
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "chapter-profile-test-"));
  Object.assign(process.env, { NODE_ENV: "test", DATA_DIR: directory, CHAPTER_LOCAL_MODE: "true", APP_ORIGIN: origin });
  for (const key of ["DATABASE_URL", "S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "GOOGLE_SHEETS_WEBHOOK_URL", "GOOGLE_SHEETS_WEBHOOK_SECRET"]) delete process.env[key];
});
after(async () => {
  await closeDatabase();
  if (!path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(directory).startsWith("chapter-profile-test-")) throw new Error("Unexpected test directory");
  await rm(directory, { recursive: true, force: true });
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
});

test("profile validates real dates, matching names, complete answers and terms without demographic eligibility rules", () => {
  assert.equal(applicationSchema.safeParse(input()).success, true);
  for (const gender of ["Male", "Female"])
    for (const dateOfBirth of ["1900-01-01", new Date(Date.now() - 86400000).toISOString().slice(0, 10)])
      assert.equal(applicationSchema.safeParse({ ...input(), profile: { ...profile, gender, dateOfBirth } }).success, true);
  const invalid = [
    { dateOfBirth: "2025-02-29" }, { dateOfBirth: "2000-02-30" }, { dateOfBirth: "not-a-date" },
    { dateOfBirth: new Date().toISOString().slice(0, 10) }, { dateOfBirth: "2999-01-01" },
    { termsAccepted: false }, { destinationCountry: "Elsewhere" }, { englishProficiency: "Maybe" },
    { gender: "" }, { address: "" }, { currentWorkCountry: undefined }, { nationality: "test\u0000value" },
  ];
  for (const change of invalid)
    assert.equal(applicationSchema.safeParse({ ...input(), profile: { ...profile, ...change } }).success, false, JSON.stringify(change));
  const mismatch = applicationSchema.safeParse({ ...input(), fullName: "Different Applicant" });
  assert.equal(mismatch.success, false);
  if (!mismatch.success) assert.ok(mismatch.error.issues.some((issue) => issue.path.join(".") === "fullName"));
  assert.equal(applicationSchema.safeParse({ ...input(), summary: "s".repeat(1001) }).success, false);
  const { profile: _profile, ...legacy } = input(); void _profile;
  assert.equal(applicationSchema.safeParse({ ...legacy, summary: "s".repeat(4000) }).success, true);
});

test("reference-only profile answers normalize unasked fields honestly while legacy requests still require them", () => {
  const parsed = applicationSchema.parse(referenceInput());
  assert.equal(parsed.country, profile.currentWorkCountry);
  assert.equal(parsed.recentJobTitle, "");
  assert.equal(parsed.experienceYears, null);
  assert.equal(parsed.skills, "");
  assert.equal(parsed.education, "");
  assert.equal(parsed.summary, "");
  assert.equal(parsed.coverLetter, "");
  const { profile: _profile, ...legacy } = referenceInput(); void _profile;
  const missing = applicationSchema.safeParse(legacy);
  assert.equal(missing.success, false);
  if (!missing.success)
    for (const field of ["country", "recentJobTitle", "experienceYears", "skills"])
      assert.ok(missing.error.issues.some((issue) => issue.path[0] === field));
  for (const years of [null, 0, 1, 2, 2.99])
    assert.equal(applicationSchema.safeParse({ ...input(), profile: undefined, experienceYears: years }).success, false);
});

test("the form accepts every offered destination without collecting or inventing nationality", () => {
  const { nationality: _nationality, ...withoutNationality } = profile; void _nationality;
  for (const destinationCountry of destinationCountries) {
    const parsed = applicationSchema.parse({ ...referenceInput(), profile: { ...withoutNationality, destinationCountry } });
    assert.equal(parsed.profile?.destinationCountry, destinationCountry);
    assert.equal(Object.hasOwn(parsed.profile!, "nationality"), false);
  }
  assert.equal(applicationSchema.parse(referenceInput()).profile?.nationality, "Filipino", "Legacy nationality answers remain readable");
});

test("structured addresses trim and normalize every part, preserve postal text and require all four pieces", () => {
  const structured = { ...profile, address: "Stale combined address", street: " 17 Sample Street ", city: " Manila ", province: " Metro Manila ", postalCode: " 0017 " };
  const parsed = applicationSchema.parse({ ...referenceInput(), profile: structured }).profile!;
  assert.equal(parsed.street, "17 Sample Street");
  assert.equal(parsed.city, "Manila");
  assert.equal(parsed.province, "Metro Manila");
  assert.equal(parsed.postalCode, "0017");
  assert.equal(parsed.address, "17 Sample Street, Manila, Metro Manila, 0017");
  assert.equal(applicationSchema.parse({ ...referenceInput(), profile: { ...structured, address: "", postalCode: " SW1A 1AA " } }).profile?.postalCode, "SW1A 1AA");
  assert.equal(applicationSchema.parse({ ...referenceInput(), profile: { ...structured, address: undefined } }).profile?.address, parsed.address);
  for (const field of ["street", "city", "province", "postalCode"] as const) {
    for (const absent of [undefined, "   "]) {
      const result = applicationSchema.safeParse({ ...referenceInput(), profile: { ...structured, [field]: absent } });
      assert.equal(result.success, false);
      if (!result.success) assert.ok(result.error.issues.some((issue) => issue.path.join(".") === `profile.${field}`));
    }
  }
  const empty = applicationSchema.safeParse({ ...referenceInput(), profile: { ...profile, address: "", street: "", city: "", province: "", postalCode: "" } });
  assert.equal(empty.success, false);
  if (!empty.success) assert.deepEqual(empty.error.issues.map((issue) => issue.path.join(".")).sort(), ["profile.city", "profile.postalCode", "profile.province", "profile.street"]);
  const defaults = applicationSchema.safeParse({ ...referenceInput(), profile: { ...profile, gender: "", englishProficiency: "", address: "", street: "", city: "", province: "", postalCode: "" } });
  assert.equal(defaults.success, false);
  if (!defaults.success) {
    const paths = defaults.error.issues.map((issue) => issue.path.join("."));
    for (const field of ["street", "city", "province", "postalCode"])
      assert.equal(paths.filter((path) => path === `profile.${field}`).length, 1);
    assert.ok(paths.includes("profile.gender"));
    assert.ok(paths.includes("profile.englishProficiency"));
  }
  const partial = applicationSchema.safeParse({ ...referenceInput(), profile: { ...profile, city: "Manila" } });
  assert.equal(partial.success, false);
  if (!partial.success) assert.deepEqual(partial.error.issues.map((issue) => issue.path.join(".")).sort(), ["profile.postalCode", "profile.province", "profile.street"]);
  const legacy = applicationSchema.parse(referenceInput()).profile!;
  assert.equal(legacy.address, profile.address);
  assert.equal(legacy.street, undefined);
  const maximum = { ...structured, address: "", street: "s".repeat(140), city: "c".repeat(60), province: "p".repeat(60), postalCode: "0".repeat(20) };
  assert.equal(applicationSchema.parse({ ...referenceInput(), profile: maximum }).profile?.address.length, 286);
  for (const field of ["street", "city", "province", "postalCode"] as const) {
    const tooLong = applicationSchema.safeParse({ ...referenceInput(), profile: { ...maximum, [field]: maximum[field] + "x" } });
    assert.equal(tooLong.success, false);
    if (!tooLong.success) assert.ok(tooLong.error.issues.some((issue) => issue.path.join(".") === `profile.${field}`));
  }
});

test("profile submissions require individual files, retain private categories, recover retries and deliver legacy-compatible Sheets payloads", async () => {
  const job = (await getJobs())[0];
  const values = input(job.id);
  const key = randomUUID();
  function request(categories: string[], overrides = {}, changed = false) {
    const form = new FormData();
    form.set("payload", JSON.stringify({ ...values, ...overrides }));
    form.set("idempotencyKey", key);
    form.set("resume", new File([pdf], "cv.pdf"));
    for (const category of categories)
      form.append(`document:${category}`, new File([changed && category === "passport" ? Buffer.from("%PDF-1.4\nChanged passport\n%%EOF") : pdf], `${category}.pdf`));
    return new NextRequest(`${origin}/api/applications`, { method: "POST", headers: { origin }, body: form });
  }
  const missing = await submit(request([]));
  assert.equal(missing.status, 422);
  assert.deepEqual(Object.keys((await missing.json()).fieldErrors).sort(), ["document:passport", "document:residence-id"]);
  assert.equal((await getApplications()).length, 0);
  const duplicate = await submit(request(["passport", "passport", "residence-id", "diploma"]));
  assert.equal(duplicate.status, 422);
  assert.ok((await duplicate.json()).fieldErrors["document:passport"]);
  const categories = ["passport", "residence-id", "diploma", "employment-certificate"];
  const accepted = await submit(request(categories));
  assert.equal(accepted.status, 201);
  const receipt = await accepted.json();
  assert.equal((await submit(request(categories))).status, 200);
  assert.equal((await submit(request(categories, {}, true))).status, 409);
  const [stored] = await getApplications();
  assert.equal(stored.reference, receipt.reference);
  assert.deepEqual(stored.profile, profile);
  assert.deepEqual(stored.documents?.map(({ category }) => category).sort(), [...categories].sort());
  for (const document of stored.documents || []) assert.deepEqual(await readObject(document.key), pdf);
  const delivery = await drainSheetsQueue({ applicationId: stored.id }, { transport: async (payload) => {
    assert.equal("profile" in payload.application, false);
    assert.deepEqual(payload.documents?.map(({ category }) => category), ["diploma"]);
    assert.match(payload.application.summary, /Gender: Female/);
    assert.match(payload.application.summary, /Speaks and understands English: No/);
    assert.match(payload.application.summary, /Passport: passport.pdf/);
    assert.match(payload.application.summary, /Residence ID: residence-id.pdf/);
    assert.match(payload.application.summary, /Certificate of employment: employment-certificate.pdf/);
    assert.match(payload.application.summary, /authorized recruitment workspace/);
    assert.ok(payload.application.summary.length <= 4000);
    return { ok: true, applicationId: stored.id, reference: stored.reference, row: 2, duplicate: false };
  } });
  assert.equal(delivery.delivered, 1);
});

test("profile uploads enforce a 4 MB combined budget and 3 MB CV limit without changing legacy CV acceptance", async () => {
  const job = (await getJobs())[0];
  const values = input(job.id);
  const beforeCount = (await getApplications()).length;
  function sizedPdf(size: number) {
    const content = Buffer.alloc(size, 32);
    content.write("%PDF-1.4\n", 0);
    content.write("\n%%EOF", size - 6);
    return content;
  }
  function request(resume: Buffer, profileRequest = true) {
    const { profile: _profile, ...legacy } = values; void _profile;
    const form = new FormData();
    form.set("payload", JSON.stringify(profileRequest ? values : legacy));
    form.set("idempotencyKey", randomUUID());
    form.set("resume", new File([new Uint8Array(resume)], "cv.pdf"));
    if (profileRequest) {
      form.set("document:passport", new File([sizedPdf(1024 * 1024)], "passport.pdf"));
      form.set("document:residence-id", new File([pdf], "residence-id.pdf"));
      form.set("document:diploma", new File([pdf], "diploma.pdf"));
    }
    return new NextRequest(`${origin}/api/applications`, { method: "POST", headers: { origin }, body: form });
  }
  const oversizedTotal = await submit(request(sizedPdf(3 * 1024 * 1024)));
  assert.equal(oversizedTotal.status, 422);
  assert.match((await oversizedTotal.json()).fieldErrors.documents, /within 4 MB/);
  const oversizedCv = await submit(request(sizedPdf(3 * 1024 * 1024 + 1)));
  assert.equal(oversizedCv.status, 422);
  assert.match((await oversizedCv.json()).fieldErrors.resume, /3 MB/);
  assert.equal((await getApplications()).length, beforeCount);
  const legacy = await submit(request(sizedPdf(3 * 1024 * 1024 + 1), false));
  assert.equal(legacy.status, 201);
  assert.equal((await getApplications()).length, beforeCount + 1);
});

test("reference-only applications persist structured addresses and blank experience and accept optional driver documents for every job", async () => {
  const originalJob = (await getJobs())[0];
  const id = randomUUID();
  await saveJob({ ...originalJob, id, slug: `reference-${id}`, title: "Custom reference vacancy" }, "test-staff", true);
  const key = randomUUID();
  function request(postalCode = " 0017 ") {
    const form = new FormData();
    form.set("payload", JSON.stringify({ ...referenceInput(id), email: "reference-only@example.test", driverLicenseDetails: "Category B",
      profile: { ...profile, address: "Stale combined address", street: " 17 Sample Street ", city: " Manila ", province: " Metro Manila ", postalCode } }));
    form.set("idempotencyKey", key);
    form.set("resume", new File([pdf], "cv.pdf"));
    for (const category of ["passport", "residence-id", "diploma", "driver-license"])
      form.set(`document:${category}`, new File([pdf], `${category}.pdf`));
    return new NextRequest(`${origin}/api/applications`, { method: "POST", headers: { origin }, body: form });
  }
  const accepted = await submit(request());
  assert.equal(accepted.status, 201);
  const receipt = await accepted.json();
  assert.equal((await submit(request())).status, 200);
  assert.equal((await submit(request("0018"))).status, 409);
  const stored = (await getApplications()).find(({ reference }) => reference === receipt.reference)!;
  assert.equal(stored.country, "Philippines");
  assert.equal(stored.profile?.street, "17 Sample Street");
  assert.equal(stored.profile?.city, "Manila");
  assert.equal(stored.profile?.province, "Metro Manila");
  assert.equal(stored.profile?.postalCode, "0017");
  assert.equal(stored.profile?.address, "17 Sample Street, Manila, Metro Manila, 0017");
  assert.equal(stored.recentJobTitle, "");
  assert.equal(stored.experienceYears, null);
  assert.equal(stored.skills, "");
  assert.equal(stored.driverLicenseDetails, "Category B");
  assert.ok(stored.documents?.some(({ category }) => category === "driver-license"));
  const delivery = await drainSheetsQueue({ applicationId: stored.id }, { transport: async (payload) => {
    assert.equal(payload.application.experienceYears, null);
    assert.equal(payload.application.recentJobTitle, "");
    assert.equal(payload.application.skills, "");
    assert.match(payload.application.summary, /reference form does not collect most recent role, years of experience or a separate skills statement/);
    assert.match(payload.application.summary, /Street: 17 Sample Street\nCity: Manila\nProvince: Metro Manila\nPostal code: 0017/);
    assert.deepEqual(payload.documents?.map(({ category }) => category).sort(), ["diploma", "driver-license"]);
    return { ok: true, applicationId: stored.id, reference: stored.reference, row: 2, duplicate: false };
  } });
  assert.equal(delivery.delivered, 1);
});

test("work-permit documents may be absent initially and available NBI and Form 18a files still persist and export", async () => {
  const job = (await getJobs())[0];
  for (const permitDocuments of [[], ["nbi", "form18a"]]) {
    const form = new FormData();
    form.set("payload", JSON.stringify({ ...referenceInput(job.id), email: `permit-${permitDocuments.length}@example.test` }));
    form.set("idempotencyKey", randomUUID());
    form.set("resume", new File([pdf], "cv.pdf"));
    const categories = ["passport", "residence-id", ...permitDocuments];
    for (const category of categories) form.set(`document:${category}`, new File([pdf], `${category}.pdf`));
    const accepted = await submit(new NextRequest(`${origin}/api/applications`, { method: "POST", headers: { origin }, body: form }));
    assert.equal(accepted.status, 201);
    const receipt = await accepted.json();
    const stored = (await getApplications()).find(({ reference }) => reference === receipt.reference)!;
    assert.deepEqual(stored.documents?.map(({ category }) => category).sort(), [...categories].sort());
    assert.ok(!stored.documents?.some(({ category }) => category === "diploma" || category === "nc2"));
    for (const document of stored.documents || []) assert.deepEqual(await readObject(document.key), pdf);
    const delivery = await drainSheetsQueue({ applicationId: stored.id }, { transport: async (payload) => {
      assert.equal(payload.version, permitDocuments.length ? 2 : 1);
      assert.deepEqual(payload.documents?.map(({ category }) => category) || [], permitDocuments);
      for (const document of payload.documents || []) {
        assert.equal(document.base64, pdf.toString("base64"));
        assert.equal(document.id, stored.documents?.find(({ category }) => category === document.category)?.id);
      }
      return { ok: true, applicationId: stored.id, reference: stored.reference, row: 2, duplicate: false };
    } });
    assert.equal(delivery.delivered, 1);
  }
});

test("driver roles require a license in both form variants and additional roles retain their actual title", async () => {
  for (const title of ["Truck Driver", "FORKLIFT DRIVER", "Bus drivers"])
    assert.equal(isDriverPosition(title), true);
  assert.equal(isDriverPosition("Cleaner"), false);
  assert.deepEqual(getRequiredProfileDocumentCategories("Cleaner"), ["passport", "residence-id"]);
  assert.deepEqual(getRequiredProfileDocumentCategories("Truck Driver"), ["passport", "residence-id", "driver-license"]);

  const driver = additionalApplicationJobs.find(({ title }) => isDriverPosition(title))!;
  assert.ok(driver);
  const key = randomUUID();
  const { nationality: _nationality, ...withoutNationality } = profile; void _nationality;
  const values = { ...input(driver.id), email: "additional-driver@example.test", profile: { ...withoutNationality, destinationCountry: "Montenegro" } };
  function request(withLicense: boolean, legacy = false) {
    const { profile: _profile, ...legacyValues } = values; void _profile;
    const form = new FormData();
    form.set("payload", JSON.stringify(legacy ? legacyValues : values));
    form.set("idempotencyKey", key);
    form.set("resume", new File([pdf], "cv.pdf"));
    for (const category of ["passport", "residence-id", ...(withLicense ? ["driver-license"] : [])])
      form.set(`document:${category}`, new File([pdf], `${category}.pdf`));
    return new NextRequest(`${origin}/api/applications`, { method: "POST", headers: { origin }, body: form });
  }
  for (const legacy of [false, true]) {
    const missing = await submit(request(false, legacy));
    assert.equal(missing.status, 422);
    assert.deepEqual(Object.keys((await missing.json()).fieldErrors), ["document:driver-license"]);
  }
  const accepted = await submit(request(true));
  assert.equal(accepted.status, 201, JSON.stringify(await accepted.clone().json()));
  const receipt = await accepted.json();
  assert.equal(receipt.jobTitle, driver.title);
  assert.equal((await submit(request(true))).status, 200);
  const stored = (await getApplications()).find(({ reference }) => reference === receipt.reference)!;
  assert.equal(stored.jobId, driver.id);
  assert.equal(stored.jobTitle, driver.title);
  assert.equal(stored.profile?.destinationCountry, "Montenegro");
  assert.equal(Object.hasOwn(stored.profile!, "nationality"), false);
  const delivery = await drainSheetsQueue({ applicationId: stored.id }, { transport: async (payload) => {
    assert.equal(payload.application.jobTitle, driver.title);
    assert.match(payload.application.summary, /Destination country: Montenegro/);
    assert.doesNotMatch(payload.application.summary, /Nationality:/);
    assert.ok(payload.documents?.some(({ category }) => category === "driver-license"));
    return { ok: true, applicationId: stored.id, reference: stored.reference, row: 2, duplicate: false };
  } });
  assert.equal(delivery.delivered, 1);
});

test("application-only roles stay off public job lists and preserve staff closures", async () => {
  const role = additionalApplicationJobs.find(({ title }) => !isDriverPosition(title))!;
  assert.ok(role);
  assert.equal((await getJobs()).some(({ applicationOnly }) => applicationOnly), false);
  assert.equal(await getJobBySlug(role.slug), undefined);
  assert.equal((await getJobById(role.id))?.title, role.title);
  assert.ok((await getJobs({ includeApplicationOnly: true })).some(({ id }) => id === role.id));
  await saveJob({ ...role, status: "closed" }, "test-staff");
  await closeDatabase();
  assert.equal((await getJobById(role.id))?.status, "closed");
  assert.equal((await getJobs({ includeApplicationOnly: true })).some(({ id }) => id === role.id), false);
  const form = new FormData();
  form.set("payload", JSON.stringify({ ...referenceInput(role.id), email: "closed-additional@example.test" }));
  form.set("idempotencyKey", randomUUID());
  form.set("resume", new File([pdf], "cv.pdf"));
  for (const category of ["passport", "residence-id"])
    form.set(`document:${category}`, new File([pdf], `${category}.pdf`));
  assert.equal((await submit(new NextRequest(`${origin}/api/applications`, { method: "POST", headers: { origin }, body: form }))).status, 409);
});
