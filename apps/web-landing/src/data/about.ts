import type { IconName } from "../lib/icons";
import { images, portrait } from "../lib/images";

/**
 * 09.01 About CV. Inti Multi Solusi · Meet Our Team.
 * TODO(content): the design marks the team as illustrative demo content, and its
 * company facts (est. 2012, Jakarta head office) differ from the home page (since 2014,
 * Bekasi). Confirm with IMS before launch.
 */

export const aboutStats = [
  { value: "12+", label: "Years of operation" },
  { value: "850+", label: "Projects delivered" },
  { value: "2,400+", label: "Gates & turnstiles installed", mobileLabel: "Gates installed" },
  { value: "34", label: "Provinces served" },
];

export const companyFacts = [
  { label: "Legal entity", value: "CV. Inti Multi Solusi" },
  { label: "Established", value: "2012, Jakarta" },
  { label: "Head office", value: "Jakarta Selatan, DKI Jakarta", mobileValue: "Jakarta Selatan" },
  { label: "Branches", value: "Surabaya · Medan · Makassar" },
  { label: "Certifications", value: "ISO 9001:2015 · TKDN registered", mobileValue: "ISO 9001:2015 · TKDN" },
  { label: "Team", value: "140+ engineers & specialists", mobileValue: "140+ specialists" },
];

export const vision = {
  statement: "“To be Indonesia’s most trusted partner for intelligent access — where every entrance is secure, seamless and connected.”",
  initials: "AS",
  name: "Ir. Agus Santoso",
  role: "Founder & Managing Director",
};

export const missions = [
  {
    text: "Deliver reliable, locally-supported access hardware engineered for Indonesian conditions.",
    mobileText: "Deliver reliable, locally-supported access hardware engineered for Indonesia.",
  },
  {
    text: "Build integrated software that turns every entry into actionable business data.",
    mobileText: "Build integrated software that turns every entry into business data.",
  },
  {
    text: "Provide end-to-end service — consultation, installation, training and lifetime maintenance.",
    mobileText: "Provide end-to-end service — from consultation to lifetime maintenance.",
  },
  {
    text: "Grow a skilled national workforce of access-control engineers and technicians.",
    mobileText: "Grow a skilled national workforce of access-control engineers.",
  },
];

export const pillars: {
  icon: IconName;
  title: string;
  description: string;
  mobileDescription: string;
  bullets: string[];
}[] = [
  {
    icon: "factory",
    title: "Hardware Manufacturing & Supply",
    description:
      "Swing and flap barriers, turnstiles, parking barriers and enclosures assembled at our Bekasi workshop with TKDN-compliant components.",
    mobileDescription: "Barrier gates, turnstiles and enclosures assembled at our Bekasi workshop with TKDN-compliant parts.",
    bullets: ["Custom cabinets & finishes", "Stainless SUS304 builds", "Local spare-part stock"],
  },
  {
    icon: "code",
    title: "Software Development",
    description:
      "Entragate Suite — gym, ticketing, visitor, library, parking and access platforms built and maintained by our in-house product team.",
    mobileDescription: "Entragate Suite — six business platforms built and maintained by our in-house product team.",
    bullets: ["Cloud & on-premise", "Mobile apps & kiosks", "Open REST API"],
  },
  {
    icon: "wrench",
    title: "System Integration & Service",
    description:
      "Site survey, design, installation and commissioning — backed by preventive maintenance contracts and 24/7 helpdesk.",
    mobileDescription: "Survey, installation and commissioning, backed by SLA maintenance and 24/7 helpdesk.",
    bullets: ["Nationwide installation", "SLA maintenance", "Operator training"],
  },
];

export const technologies: { icon: IconName; title: string; description: string; mobileDescription: string }[] = [
  {
    icon: "scan-face",
    title: "Face Recognition AI",
    description: "Liveness-detecting terminals verifying identity in 0.2 s with mask & helmet support.",
    mobileDescription: "Liveness detection, 0.2 s verification.",
  },
  {
    icon: "nfc",
    title: "RFID & NFC Credentials",
    description: "MIFARE DESFire, EM and HID cards, wristbands and mobile NFC keys.",
    mobileDescription: "MIFARE, EM, HID cards and mobile keys.",
  },
  {
    icon: "qr-code",
    title: "Dynamic QR Access",
    description: "Time-bound, encrypted QR passes for visitors, tickets and parking.",
    mobileDescription: "Encrypted, time-bound passes.",
  },
  {
    icon: "scan-line",
    title: "License Plate Recognition",
    description: "ANPR cameras tuned for Indonesian plates, day and night.",
    mobileDescription: "ANPR tuned for Indonesian plates.",
  },
  {
    icon: "cpu",
    title: "IoT Gate Controllers",
    description: "Edge controllers with offline mode, anti-passback and fire-alarm release.",
    mobileDescription: "Offline mode and anti-passback.",
  },
  {
    icon: "cloud",
    title: "Cloud Platform",
    description: "Multi-site SaaS with encrypted data hosted in Indonesian data centres.",
    mobileDescription: "Multi-site SaaS hosted in Indonesia.",
  },
];

export const values: { icon: IconName; title: string; description: string; mobileDescription: string }[] = [
  {
    icon: "shield-check",
    title: "Integrity",
    description: "We quote honestly, deliver what we specify and stand behind every installation.",
    mobileDescription: "Honest quotes, delivered as specified.",
  },
  {
    icon: "crosshair",
    title: "Precision",
    description: "Engineering discipline in every weld, wire and line of code we ship.",
    mobileDescription: "Discipline in every weld and line of code.",
  },
  {
    icon: "handshake",
    title: "Partnership",
    description: "Long-term relationships — most clients have been with us 5+ years.",
    mobileDescription: "Most clients stay with us 5+ years.",
  },
  {
    icon: "lightbulb",
    title: "Innovation",
    description: "Continuous R&D so your facility stays ahead of new security demands.",
    mobileDescription: "Continuous R&D for new demands.",
  },
];

export const portfolio = [
  {
    tag: "Stadium · 2024",
    title: "National Sports Arena, Jakarta", image: images.stadiumEntrance,
    mobileTitle: "National Sports Arena",
    meta: "96 tripod turnstiles & 48 flap lanes · E-Ticketing integration for 77,000 seats",
    mobileMeta: "96 turnstiles · 77,000 seats",
  },
  {
    tag: "Campus · 2023",
    title: "Universitas Nusantara", image: images.transitTurnstiles,
    meta: "Library & campus access, 32 lanes",
    mobileMeta: "Library & campus access",
  },
  { tag: "Fitness · 2025", title: "FitLife Gym Chain", image: images.hotelLobby, meta: "Face ID gates at 18 branches", mobileMeta: "Face ID at 18 branches" },
  { tag: "Parking · 2024", title: "Grand Mall Surabaya", image: images.parkingEntrance, meta: "LPR ticketless parking, 2,100 bays", mobileMeta: "LPR ticketless parking" },
  { tag: "Office · 2023", title: "Menara Sentral Tower", image: images.officeLobby, meta: "Visitor & access for 42 floors", mobileMeta: "Visitor & access, 42 floors" },
];

export const brandChips = ["Barrier Gates", "Turnstiles", "Parking", "Face Recognition", "Software"];

export type TeamMember = { name: string; title: string; bio: string; portrait?: string };
export type TeamGroup = { title: string; description: string; members: TeamMember[] };

export const leadership: TeamGroup = {
  title: "Leadership Team",
  description: "Setting direction for Indonesia’s access-control market since 2012.",
  members: [
    {
      name: "Budi Hartono",
      portrait: portrait(5),
      title: "President Director & Founder",
      bio: "Founded IMS in 2012 after 15 years in building automation. Leads strategy and national partnerships.",
    },
    {
      name: "Ratna Sari Dewi",
      portrait: portrait(3),
      title: "Director of Operations",
      bio: "Oversees manufacturing, logistics and installation teams across Jakarta, Surabaya and Medan.",
    },
    {
      name: "Michael Tanuwijaya",
      portrait: portrait(2),
      title: "Chief Technology Officer",
      bio: "Architect of the Entragate cloud platform and face-recognition engine. Former R&D lead in Singapore.",
    },
    {
      name: "Lina Marlina",
      portrait: portrait(4),
      title: "Finance Director",
      bio: "Leads finance, tax compliance and corporate credit programs for enterprise and government clients.",
    },
  ],
};

export const teamGroups: TeamGroup[] = [
  {
    title: "Software Development",
    description: "Building the apps, cloud and firmware behind every Entragate gate.",
    members: [
      {
        name: "Ahmad Fauzi",
      portrait: portrait(13),
        title: "Head of Software Engineering",
        bio: "Runs the 18-person platform team shipping the customer portal, mobile app and gate firmware.",
      },
      {
        name: "Putri Ayu Lestari",
      portrait: portrait(6),
        title: "Lead Web & Mobile Engineer",
        bio: "Designs the Entragate app experience used daily by over 400,000 members and visitors.",
      },
      {
        name: "Kevin Halim",
      portrait: portrait(9),
        title: "Cloud & IoT Engineer",
        bio: "Keeps 12,000+ connected controllers online with real-time monitoring and OTA updates.",
      },
    ],
  },
  {
    title: "Engineering & Technical Support",
    description: "On-site installation, maintenance and 24/7 technical assistance.",
    members: [
      {
        name: "Dedi Kurniawan",
      portrait: portrait(14),
        title: "Head of Field Engineering",
        bio: "Leads 40+ certified technicians delivering installations and SLA maintenance nationwide.",
      },
      {
        name: "Wahyu Nugroho",
      portrait: portrait(15),
        title: "Senior Installation Engineer",
        bio: "Specialist in stadium and transit-scale turnstile deployments and site commissioning.",
      },
      {
        name: "Sri Wahyuni",
      portrait: portrait(7),
        title: "Technical Support Lead",
        bio: "Runs the 24/7 helpdesk and remote diagnostics team with a 15-minute response target.",
      },
    ],
  },
  {
    title: "Sales & Customer Relations",
    description: "Your partners from first site survey to renewal.",
    members: [
      {
        name: "Reza Mahendra",
      portrait: portrait(10),
        title: "Head of Corporate Sales",
        bio: "Guides developers, universities and government agencies through complex access projects.",
      },
      {
        name: "Sari Puspita",
      portrait: portrait(16),
        title: "Key Account Manager",
        bio: "Dedicated manager for 60+ corporate accounts — known for answering within the hour.",
      },
      {
        name: "Nadia Rahmawati",
      portrait: portrait(8),
        title: "Customer Success Manager",
        bio: "Leads onboarding, training and quarterly reviews so every installation delivers value.",
      },
    ],
  },
  {
    title: "Operations",
    description: "Supply chain, warehousing and project delivery that keep promises on time.",
    members: [
      {
        name: "Joko Susilo",
      portrait: portrait(11),
        title: "Supply Chain & Warehouse Manager",
        bio: "Manages inventory across three warehouses with same-week dispatch on stocked models.",
      },
      {
        name: "Fitri Handayani",
      portrait: portrait(12),
        title: "Project Coordinator",
        bio: "Coordinates schedules, permits and handover documents for 150+ projects every year.",
      },
    ],
  },
];

export const offices = [
  {
    title: "Head Office — Jakarta",
    address: "Jl. TB Simatupang No. 41, Cilandak, Jakarta Selatan 12560",
    phone: "(021) 7590 2288",
    phoneHref: "tel:+622175902288",
    email: "info@intimultisolusi.co.id",
    primary: true,
  },
  {
    title: "Branch — Surabaya",
    address: "Jl. Raya Darmo No. 88, Surabaya 60265",
    phone: "(031) 5678 120",
    phoneHref: "tel:+62315678120",
    email: "surabaya@intimultisolusi.co.id",
  },
  {
    title: "Branch — Medan",
    address: "Jl. Gatot Subroto No. 210, Medan 20122",
    phone: "(061) 4521 330",
    phoneHref: "tel:+62614521330",
    email: "medan@intimultisolusi.co.id",
  },
];
