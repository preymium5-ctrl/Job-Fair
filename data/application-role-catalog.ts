import { destinationCountries } from "./application-form-options";

type RoleTerms = readonly [title: string, minimum: number, maximum: number, openings: number];
type Sector = {
  category: string;
  image: string;
  summary: string;
  responsibilities: readonly string[];
  roles: readonly RoleTerms[];
};

// Display proposals requested by the site operator on 21 October 2026.
// These amounts and slots are planning figures, not employer-confirmed offers.
// Employers, approvals, workplace addresses and contract terms are not inferred.
export const applicationRoleSectors: readonly Sector[] = [
  {
    category: "Hospitality & Food Service", image: "/images/jobs/categories/hospitality-food-service.webp",
    summary: "Support welcoming guest experiences and reliable food and beverage service.",
    responsibilities: ["Prepare the assigned service area, tools, and supplies for the shift.", "Follow the workplace's confirmed service, food hygiene, and quality procedures.", "Coordinate with colleagues and report guest requests, stock needs, or service concerns."],
    roles: [
      ["Waiter/Waitress", 850, 1200, 1200], ["Bartender", 950, 1350, 650],
      ["Sushi Chef", 1300, 1900, 400], ["Baker", 1050, 1550, 600],
      ["Kitchen Helper", 850, 1100, 1100], ["Grill Cook", 1100, 1600, 650],
      ["Assistant Cook", 950, 1300, 900], ["Barista", 900, 1250, 700],
      ["Chef", 1400, 2000, 500], ["Cook", 1100, 1600, 1000],
      ["Hostess", 850, 1200, 350], ["Pizza Maker", 1050, 1500, 650],
      ["Bread Baker", 1050, 1550, 550], ["Dishwasher", 850, 1050, 950],
    ],
  },
  {
    category: "Production & Manufacturing", image: "/images/jobs/categories/production-manufacturing.webp",
    summary: "Prepare materials and support consistent production, assembly, and quality checks.",
    responsibilities: ["Check the assigned materials, components, and production instructions before starting.", "Carry out authorised production or assembly tasks using the required safety controls.", "Record completed work and report damaged materials, quality differences, or equipment issues."],
    roles: [
      ["Production worker (Concrete Molder)", 950, 1350, 1000],
      ["Furniture Assembler", 1000, 1450, 750],
      ["Production and Fabrication of Aluminum and PVC (Doors, Windows, etc.)", 1050, 1500, 900],
      ["Factory Worker", 850, 1200, 1200], ["Machine Operator", 1000, 1450, 1000],
      ["Production Worker", 900, 1250, 1150], ["Wood Workers", 1000, 1450, 700],
      ["Press Machine Technician", 1200, 1750, 350],
    ],
  },
  {
    category: "Industrial Finishing", image: "/images/male-workers/grinder-and-cleaner.webp",
    summary: "Prepare and finish components carefully to the assigned surface and quality requirements.",
    responsibilities: ["Inspect the assigned component and identify the surfaces requiring preparation.", "Use the approved finishing tools and materials within confirmed safety procedures.", "Check the completed finish and report defects or components requiring further attention."],
    roles: [["Grinder (Propeller)", 1050, 1500, 600], ["Industrial Painter", 1000, 1450, 750], ["Spray Painter", 1000, 1450, 700]],
  },
  {
    category: "Cleaning & Facilities", image: "/images/male-workers/cleaner.webp",
    summary: "Keep guest rooms, shared spaces, and workplace facilities clean, orderly, and ready for use.",
    responsibilities: ["Prepare cleaning supplies or maintenance tools for the assigned area.", "Follow the confirmed cleaning, hygiene, or routine maintenance schedule.", "Report damaged facilities, missing supplies, and issues requiring specialist attention."],
    roles: [["Housekeeping", 850, 1150, 1200], ["Building Maintenance", 1000, 1450, 800], ["Domestic Helper", 850, 1100, 700], ["Laundry Staff", 850, 1100, 850], ["Room Attendant", 850, 1150, 1000]],
  },
  {
    category: "Automotive & Vehicle Maintenance", image: "/images/jobs/categories/automotive-vehicle-maintenance.webp",
    summary: "Support vehicle inspection, maintenance, repair, and finishing within the assigned workshop scope.",
    responsibilities: ["Check the work order and inspect the assigned vehicle or component before starting.", "Perform authorised workshop tasks using suitable tools and documented safety procedures.", "Record completed work and report defects or additional repairs for supervisor review."],
    roles: [
      ["Car Mechanic", 1150, 1700, 900], ["Forklift Mechanic / Mechatronics", 1250, 1850, 450],
      ["Auto Tinsmith / Auto Bodyworker", 1100, 1650, 650], ["Car Interior Upholstery", 1000, 1450, 400],
      ["Car Painter", 1100, 1600, 600], ["Heavy Vehicle Mechanic", 1300, 1900, 550],
      ["Tire Changer - Vulcanizer", 950, 1300, 500],
    ],
  },
  {
    category: "Electrical", image: "/images/male-workers/electrical-installer.webp",
    summary: "Carry out electrical work within the approved drawings, instructions, and limits of authorisation.",
    responsibilities: ["Check the assigned electrical drawings, components, and approved work scope.", "Follow confirmed isolation and safety procedures while carrying out authorised tasks.", "Document completed work and report issues for inspection by authorised personnel."],
    roles: [["Forklift Electrician", 1200, 1750, 400], ["Automotive Electrician", 1200, 1750, 600], ["Car Electrician", 1150, 1700, 550], ["Construction Electrician", 1150, 1700, 900], ["Electrician", 1150, 1700, 1000], ["Electrical Engineer", 1450, 2000, 300], ["High-Voltage Electrician", 1400, 2000, 350]],
  },
  {
    category: "Personal Care & Services", image: "/images/jobs/categories/personal-care-services.webp",
    summary: "Provide attentive personal services within the confirmed role and workplace procedures.",
    responsibilities: ["Prepare the service area and check equipment, tools, and supplies.", "Carry out the assigned service with attention to client requests, hygiene, and safe practice.", "Keep service records where required and report supply or equipment concerns."],
    roles: [["Massage Therapist", 1000, 1500, 500], ["Barber", 1000, 1450, 600], ["Seamstress/Tailoring", 950, 1400, 550], ["Beautician", 1000, 1450, 450], ["Hairdresser", 1000, 1450, 650], ["Nail Technician", 950, 1400, 500], ["Pet Groomer", 1000, 1450, 300]],
  },
  {
    category: "Design, Sales & Media", image: "/images/jobs/categories/design-sales-media.webp",
    summary: "Support clear communication, organised customer service, and the assigned creative or commercial work.",
    responsibilities: ["Review the assigned brief, customer request, or schedule before starting.", "Prepare accurate work and communicate progress with the appropriate team members.", "Keep relevant records organised and report requests or issues requiring follow-up."],
    roles: [["Cashier/Store Assistant", 850, 1200, 950], ["Receptionist", 900, 1300, 700], ["3D Designer / Interior Architect", 1400, 2000, 300], ["News Presenter", 1300, 1900, 250], ["Sales Executive/ Medical Tourism", 1200, 1800, 350]],
  },
  {
    category: "Maritime & Yacht Services", image: "/images/jobs/categories/maritime-yacht-services.webp",
    summary: "Support vessel operations, upkeep, or repair within the assigned maritime work scope.",
    responsibilities: ["Check the assigned work area, tools, and vessel instructions before the task.", "Carry out authorised vessel duties or maintenance under confirmed safety procedures.", "Keep equipment and work areas orderly and report defects to the responsible supervisor."],
    roles: [["Deck Hand Sailor", 1100, 1650, 600], ["Sailor", 1150, 1700, 550], ["Yacht Maintenance", 1150, 1700, 400], ["Fisherman", 1000, 1450, 650], ["Shipfitter", 1250, 1850, 450], ["Yacht Carpenter", 1250, 1850, 350], ["Yacht Painter", 1150, 1700, 400]],
  },
  {
    category: "Transport & Logistics", image: "/images/jobs/categories/transport-logistics.webp",
    summary: "Support organised movement of goods or passengers and accurate transport or warehouse records.",
    responsibilities: ["Check the assigned vehicle, equipment, load, or route instructions before starting.", "Follow confirmed transport or warehouse safety procedures for the assigned duties.", "Keep delivery, movement, or stock records and promptly report damage, delays, or equipment issues."],
    roles: [["Trailer Truck Driver", 1300, 1900, 1000], ["Tow Truck Driver", 1150, 1700, 450], ["Van Driver", 1000, 1450, 800], ["Bus Driver", 1200, 1800, 750], ["Forklift Operator", 1000, 1450, 1000], ["Delivery Driver", 1000, 1450, 1100], ["Heavy Truck Driver (Dumptruck)", 1300, 1900, 850], ["Warehouseman", 900, 1300, 1200]],
  },
  {
    category: "Agriculture & Food Processing", image: "/images/jobs/categories/agriculture-food-processing.webp",
    summary: "Support careful handling of crops, grounds, or food products within the assigned work area.",
    responsibilities: ["Prepare the assigned tools, materials, or products for the day's work.", "Follow confirmed handling, hygiene, and safety procedures appropriate to the task.", "Check the condition of the work or product and report quality concerns or equipment issues."],
    roles: [["Farm Worker", 850, 1200, 1200], ["Butcher", 1100, 1600, 700], ["Fish Cutter", 950, 1350, 800], ["Gardener", 900, 1300, 650]],
  },
  {
    category: "Metal Fabrication & Welding", image: "/images/male-workers/fabricator.webp",
    summary: "Prepare, fit, or join metal components according to the assigned fabrication instructions.",
    responsibilities: ["Check the approved drawing, materials, and dimensions before starting.", "Use authorised fabrication or welding equipment within confirmed operating and safety procedures.", "Inspect completed components and record defects or differences for supervisor review."],
    roles: [["Welder TIG", 1200, 1750, 850], ["Industrial Fitter", 1150, 1700, 650], ["Welder Mig/Mag", 1200, 1750, 950], ["Welder Tig/Mig", 1250, 1800, 800]],
  },
  {
    category: "Construction & Building Trades", image: "/images/jobs/categories/construction-building-trades.webp",
    summary: "Support accurate building work from the approved plans and the supervisor's confirmed instructions.",
    responsibilities: ["Review the assigned plans, measurements, materials, and work area before starting.", "Carry out authorised building tasks using suitable tools and site safety procedures.", "Check alignment, dimensions, and workmanship and report issues to the supervisor."],
    roles: [["Construction Worker", 950, 1350, 1200], ["Carpenter/Shuttering Carpenter", 1100, 1600, 1000], ["Construction Carpenter", 1100, 1600, 950], ["Construction Foreman", 1400, 2000, 350], ["Facade Builder", 1100, 1600, 750], ["HVAC Installer", 1200, 1750, 650], ["Mason", 1050, 1550, 1100], ["Steel Fixer", 1100, 1600, 1000], ["Tile Fitter", 1100, 1600, 850]],
  },
  {
    category: "Healthcare & Dental", image: "/images/jobs/categories/healthcare-dental.webp",
    summary: "Support attentive care or specialist clinical and laboratory work within the confirmed role scope.",
    responsibilities: ["Review the assigned care or laboratory instructions and prepare the work area.", "Follow confirmed hygiene, confidentiality, and quality procedures within authorised responsibilities.", "Keep accurate records and escalate concerns to the responsible clinical or care supervisor."],
    roles: [["Caregiver", 1000, 1450, 1000], ["Dentist", 1500, 2000, 250], ["Nanny", 850, 1200, 550], ["Nurse", 1300, 1900, 900], ["Dental Technician", 1250, 1850, 500], ["ESO Cut and CAD/CAM Dental Labotary Technician", 1400, 2000, 300], ["Dental Technician (Prosthetics/ Denture Specialist)", 1350, 1950, 350], ["Dental Technician (Ceramist/ Porcelain Specialist)", 1350, 1950, 350], ["Dental Technician (CAD/ CAM Designer)", 1400, 2000, 400], ["Hair Transplant Nurse", 1350, 1950, 300]],
  },
  {
    category: "CNC & Machining", image: "/images/male-workers/cnc-operator.webp",
    summary: "Prepare and machine components carefully to the assigned drawings and tolerances.",
    responsibilities: ["Check the drawing, material, tooling, and approved setup before starting.", "Use authorised machining equipment within confirmed operating and safety procedures.", "Measure completed components and report dimensional differences or tool condition concerns."],
    roles: [["Workshop Machinist", 1200, 1750, 500]],
  },
];

export function getApplicationRoleTerms(title: string) {
  for (const sector of applicationRoleSectors) {
    const terms = sector.roles.find(([role]) => role === title);
    if (!terms) continue;
    return {
      category: sector.category, image: sector.image, summary: sector.summary,
      responsibilities: [...sector.responsibilities], minimum: terms[1], maximum: terms[2], openings: terms[3],
    };
  }
  throw new Error(`Missing public catalog terms for application role: ${title}`);
}

// Rotate only through destinations already offered in the application form.
// An assigned destination describes the operator's proposal, not a workplace address.
export function applicationRoleDestination(index: number) {
  return destinationCountries[index % destinationCountries.length];
}
