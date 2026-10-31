import assert from "node:assert/strict";
import { test } from "node:test";
import { additionalApplicationJobs, additionalApplicationJobOptions } from "../data/application-jobs";
import { countryOptions, destinationCountries, referenceJobPositions, secondaryJobPositions } from "../data/application-form-options";
import { proposedJobs } from "../data/jobs";
import { getRequiredProfileDocumentCategories, isDriverPosition } from "../lib/document-uploads";
import { jobOrderJobs } from "../data/job-orders";

// Independent snapshot of the unique primary-position choices in the linked form,
// fetched on 20 October 2026. The source repeats CAD/CAM Designer three times.
// https://api.leadconnectorhq.com/widget/form/GwbVoucwmAceEoC8opIQ
const sourcePrimaryRoles = [
  "Waiter/Waitress",
  "Production worker (Concrete Molder)",
  "Grinder (Propeller)",
  "Cleaner",
  "Car Mechanic",
  "Forklift Electrician",
  "Bartender",
  "Massage Therapist",
  "Housekeeping",
  "Cashier/Store Assistant",
  "Deck Hand Sailor",
  "Sailor",
  "Sushi Chef",
  "Baker",
  "Kitchen Helper",
  "Grill Cook",
  "Trailer Truck Driver",
  "Tow Truck Driver",
  "Farm Worker",
  "Barber",
  "Seamstress/Tailoring",
  "Butcher",
  "Furniture Assembler",
  "Yacht Maintenance",
  "Van Driver",
  "Production and Fabrication of Aluminum and PVC (Doors, Windows, etc.)",
  "Forklift Mechanic / Mechatronics",
  "Welder TIG",
  "Automotive Electrician",
  "Car Electrician",
  "Auto Tinsmith / Auto Bodyworker",
  "Welder",
  "Bus Driver",
  "Forklift Operator",
  "Construction Worker",
  "Assistant Cook",
  "Delivery Driver",
  "Barista",
  "Beautician",
  "Building Maintenance",
  "Car Interior Upholstery",
  "Car Painter",
  "Caregiver",
  "Carpenter/Shuttering Carpenter",
  "Chef",
  "Construction Carpenter",
  "Construction Electrician",
  "Construction Foreman",
  "Cook",
  "Dentist",
  "Domestic Helper",
  "Electrician",
  "Electrical Engineer",
  "Fabricator",
  "Facade Builder",
  "Factory Worker",
  "Fish Cutter",
  "Fisherman",
  "Gardener",
  "Grinder",
  "HVAC Installer",
  "Hairdresser",
  "Heavy Truck Driver (Dumptruck)",
  "Heavy Vehicle Mechanic",
  "High-Voltage Electrician",
  "Hostess",
  "Industrial Painter",
  "Industrial Fitter",
  "Laundry Staff",
  "Machine Operator",
  "Mason",
  "Nail Technician",
  "Nanny",
  "Nurse",
  "Pet Groomer",
  "Pizza Maker",
  "Production Worker",
  "Room Attendant",
  "Shipfitter",
  "Spray Painter",
  "Steel Fixer",
  "Tile Fitter",
  "Tire Changer - Vulcanizer",
  "Warehouseman",
  "Welder Mig/Mag",
  "Welder Tig/Mig",
  "Wood Workers",
  "Workshop Machinist",
  "Yacht Carpenter",
  "Yacht Painter",
  "Receptionist",
  "3D Designer / Interior Architect",
  "Dental Technician",
  "News Presenter",
  "ESO Cut and CAD/CAM Dental Labotary Technician",
  "Bread Baker",
  "Dental Technician (Prosthetics/ Denture Specialist)",
  "Dental Technician (Ceramist/ Porcelain Specialist)",
  "Dental Technician (CAD/ CAM Designer)",
  "Sales Executive/ Medical Tourism",
  "Dishwasher",
] as const;

test("all 101 unique primary roles from the linked form are represented exactly once", () => {
  assert.equal(sourcePrimaryRoles.length, 101);
  const choices = [...proposedJobs, ...additionalApplicationJobs];
  for (const title of sourcePrimaryRoles)
    assert.equal(choices.filter((job) => job.title === title).length, 1, title);
  assert.deepEqual(referenceJobPositions.filter((title) => title !== "Other (enter below)" && title !== "No other position"), [...sourcePrimaryRoles]);
  for (const title of ["Other (enter below)", "No other position"])
    assert.equal(choices.some((job) => job.title === title), false, title);
  assert.equal(additionalApplicationJobs.length, 99);
  for (const title of secondaryJobPositions.filter((title) => title !== "Other (enter below)" && title !== "No other position"))
    assert.equal([...choices, ...jobOrderJobs].filter((job) => job.title === title).length, 1, title);
  assert.ok(secondaryJobPositions.includes("Offset Web Printing Press Operator (Coldset)"));
  const officialTitles = new Set(proposedJobs.map((job) => job.title.toLowerCase()));
  assert.ok(additionalApplicationJobs.every((job) => !officialTitles.has(job.title.toLowerCase())));
});

test("application choices have distinct persistent identifiers and preserve representative IDs", () => {
  const choices = [...proposedJobs, ...additionalApplicationJobs];
  assert.equal(new Set(choices.map((job) => job.id)).size, choices.length);
  assert.equal(new Set(choices.map((job) => job.slug)).size, choices.length);
  for (const [title, id] of [
    ["Waiter/Waitress", "additional-waiter-waitress"],
    ["Grinder (Propeller)", "additional-grinder-propeller"],
    ["3D Designer / Interior Architect", "additional-3d-designer-interior-architect"],
    ["Dental Technician (CAD/ CAM Designer)", "additional-dental-technician-cad-cam-designer"],
    ["Heavy Truck Driver (Dumptruck)", "additional-heavy-truck-driver-dumptruck"],
    ["Dishwasher", "additional-dishwasher"],
  ]) {
    const job = additionalApplicationJobs.find((option) => option.title === title);
    assert.equal(job?.id, id, title);
    assert.equal(job?.slug, id, title);
  }
  assert.deepEqual(additionalApplicationJobOptions, additionalApplicationJobs.map(({ id, title, slug }) => ({ id, title, slug })));
});

test("all offered roles have operator-proposed pay and slots within the requested bounds", () => {
  for (const job of [...proposedJobs, ...additionalApplicationJobs]) {
    assert.equal(Boolean(job.applicationOnly), false, job.title);
    assert.notEqual(job.category, "Other jobs we’re offering", job.title);
    const amounts = job.salary!.match(/[\d,]+/g)!.map((value) => Number(value.replaceAll(",", "")));
    assert.equal(amounts.length, 2, job.title);
    assert.ok(amounts[0] >= 850 && amounts[1] <= 2000 && amounts[0] <= amounts[1], job.title);
    assert.equal(job.salaryStatus, "proposed-net", job.title);
    assert.ok(Number.isInteger(job.openings) && job.openings! >= 250 && job.openings! <= 1200, job.title);
    assert.ok(destinationCountries.some((country) => country === job.location), job.title);
  }
  assert.deepEqual(new Set(additionalApplicationJobs.map(({ location }) => location)), new Set(destinationCountries));
});

test("application destinations offer Croatia and the five requested countries", () => {
  assert.deepEqual(destinationCountries, ["Croatia", "Slovenia", "Serbia", "Romania", "Macedonia", "Montenegro"]);
  assert.equal(countryOptions.filter((country) => country === "Macedonia").length, 1);
  assert.equal(countryOptions.includes("North Macedonia"), false);
});

test("every offered driver role requires a license through the shared helper", () => {
  const driverTitles = new Set([
    "Trailer Truck Driver", "Tow Truck Driver", "Van Driver", "Bus Driver",
    "Delivery Driver", "Heavy Truck Driver (Dumptruck)",
  ]);
  const choices = [...proposedJobs, ...additionalApplicationJobs];
  assert.equal(choices.filter((job) => isDriverPosition(job.title)).length, driverTitles.size);
  for (const job of choices) {
    const expected = driverTitles.has(job.title);
    assert.equal(isDriverPosition(job.title), expected, job.title);
    assert.equal(getRequiredProfileDocumentCategories(job.title).includes("driver-license"), expected, job.title);
  }
  assert.equal(isDriverPosition("BUS DRIVER"), true);
  assert.equal(isDriverPosition("Truck Drivers"), true);
  assert.equal(isDriverPosition("Screwdriver Assembly Worker"), false);
});
