import type { CategorySummary } from "../types/catalog";
import { images } from "../lib/images";

/**
 * Home page content (01.01 Home — Desktop 1440 / Mobile 390).
 * Marketing copy is static; featured products/categories are placeholders for
 * ERP catalog data until the catalog endpoints are confirmed.
 * Image paths are intentionally omitted: the design's photos are not in the repo yet.
 */

export const heroStats = [
  { value: "1,200+", label: "Gates installed", shortLabel: "Gates installed" },
  { value: "350+", label: "Business clients", shortLabel: "Clients" },
  { value: "24/7", label: "Technical support", shortLabel: "Support" },
];

export const trustedClients = [
  { name: "NUSANTARA", className: "font-heading font-extrabold" },
  { name: "Bank Sentosa", className: "font-body font-bold" },
  { name: "GRAHA TOWER", className: "font-heading font-bold" },
  { name: "fitzone", className: "font-body font-extrabold" },
  { name: "Universitas Merdeka", className: "font-body font-semibold" },
  { name: "PARKIR+", className: "font-heading font-extrabold" },
];

export type FeatureCategory = CategorySummary & { highlight: string; description: string };

export const featuredCategories: { swing: FeatureCategory; parking: FeatureCategory } = {
  swing: {
    slug: "swing-barrier-gate",
    name: "Swing Barrier Gate",
    productCount: "18 products",
    image: images.swingBarrierDouble,
    highlight: "18 products · Best seller",
    description: "Tempered-glass swing wings, servo motors and anti-tailgating sensors for premium lobbies.",
  },
  parking: {
    slug: "parking-equipment",
    name: "Parking Equipment",
    productCount: "16 products",
    image: images.parkingKiosk,
    highlight: "16 products · Kiosks & sensors",
    description: "Ticket dispensers, payment kiosks, loop detectors and LPR cameras for complete parking flows.",
  },
};

export const categories: Record<
  "faceRecognition" | "flapBarrier" | "tripod" | "parkingBarrier" | "rfid" | "controllers" | "accessories",
  CategorySummary
> = {
  faceRecognition: { slug: "face-recognition", name: "Face Recognition", productCount: "12 products", image: images.faceTerminal },
  flapBarrier: { slug: "flap-barrier-gate", name: "Flap Barrier Gate", productCount: "14 products", image: images.flapBarrier },
  tripod: { slug: "tripod-turnstile", name: "Tripod Turnstile", productCount: "9 products", image: images.tripodTurnstile },
  parkingBarrier: { slug: "parking-barrier", name: "Automatic Parking Barrier", productCount: "11 products", image: images.parkingBarrier },
  rfid: { slug: "rfid-qr-scanner", name: "RFID & QR Scanner", productCount: "22 products", image: images.accessTerminal },
  controllers: { slug: "access-controllers", name: "Access Controllers", productCount: "10 products", image: images.accessController },
  accessories: { slug: "accessories", name: "Accessories", productCount: "40+ products", image: images.rfidKit },
};

/** Mobile category grid (2 columns) uses shortened names from the 390 frame. */
export const mobileCategories: CategorySummary[] = [
  { slug: "swing-barrier-gate", name: "Swing Barrier", productCount: "18 products", image: images.swingBarrierDouble },
  { slug: "flap-barrier-gate", name: "Flap Barrier", productCount: "14 products", image: images.flapBarrier },
  { slug: "tripod-turnstile", name: "Tripod Turnstile", productCount: "9 products", image: images.tripodTurnstile },
  { slug: "parking-barrier", name: "Parking Barrier", productCount: "11 products", image: images.parkingBarrier },
  { slug: "face-recognition", name: "Face Recognition", productCount: "12 products", image: images.faceTerminal },
  { slug: "rfid-qr-scanner", name: "RFID & QR", productCount: "22 products", image: images.accessTerminal },
];

export const productTabs = ["Best Sellers", "New Arrivals", "Parking", "Biometrics"];

/** Featured products on the home page, resolved from the catalog (01.01 · Featured Products). */
export const featuredProductSlugs = ["eg-swing-s200-glass", "eg-flap-f150-slim", "eg-face-pro-2", "eg-park-b6-boom"];

/** Mobile scroller order from the 390 frame. */
export const mobileFeaturedSlugs = ["eg-swing-s200-glass", "eg-face-pro-2", "eg-flap-f150-slim", "eg-park-b6-boom"];

export const solutions = [
  {
    slug: "visitor-management",
    name: "Visitor Management System",
    description: "Pre-registration, QR invites & host alerts",
    icon: "users-round",
  },
  { slug: "gym-management", name: "Gym Management System", description: "Memberships, check-ins & billing", icon: "dumbbell" },
  { slug: "e-ticketing", name: "E-Ticketing System", description: "QR tickets, gate validation, live capacity", icon: "ticket" },
  {
    slug: "library-management",
    name: "Library Management System",
    description: "Catalog, RFID loans & member access",
    icon: "library",
  },
  {
    slug: "smart-parking",
    name: "Smart Parking Software",
    mobileName: "Smart Parking System",
    description: "LPR, cashless payment & occupancy",
    icon: "square-parking",
  },
  {
    slug: "access-control",
    name: "Access Control Software",
    mobileName: "Access Control System",
    description: "Zones, schedules & audit trails",
    icon: "shield-check",
  },
] as const;

export const whyItems = [
  {
    icon: "cpu",
    title: "Integrated hardware + software",
    description: "Gates, readers and controllers ship pre-configured with Entragate software — plug in and go live in days.",
    mobileDescription: "Pre-configured systems that go live in days.",
  },
  {
    icon: "badge-check",
    title: "Industrial-grade build quality",
    mobileTitle: "Industrial-grade quality",
    description: "SUS304 stainless, IP54-rated cabinets and 3-million-cycle tested motors for 24/7 operation.",
    mobileDescription: "SUS304, IP54, 3M-cycle tested motors.",
  },
  {
    icon: "wrench",
    title: "Nationwide installation",
    description: "Certified technicians across Java, Bali, Sumatra and Kalimantan, with on-site commissioning.",
    mobileDescription: "Certified technicians in 14 provinces.",
  },
  {
    icon: "headset",
    title: "Local support & warranty",
    description: "24/7 helpdesk in Bahasa Indonesia, spare parts in stock, and up to 3-year warranty coverage.",
    mobileDescription: "24/7 helpdesk and up to 3-year warranty.",
  },
] as const;

export const industries = [
  { icon: "building-2", name: "Corporate Offices", description: "Lobby gates & visitor flow", image: images.officeLobby },
  { icon: "square-parking", name: "Malls & Parking", description: "Barriers, LPR & payments", image: images.parkingEntrance },
  { icon: "dumbbell", name: "Fitness & Clubs", description: "Member check-in & turnstiles", image: images.hotelLobby },
  { icon: "graduation-cap", name: "Campus & Libraries", description: "RFID access & loans", image: images.transitTurnstiles },
  { icon: "ticket", name: "Stadiums & Events", description: "E-ticket gates at scale", image: images.stadiumEntrance },
] as const;

export const featuredProject = {
  slug: "graha-nusantara-tower",
  image: images.mallLobby,
  title: "Graha Nusantara Tower — 24-lane smart lobby",
  tags: ["Corporate Office", "Jakarta Selatan", "2026"],
  mobileEyebrow: "Corporate Office · Jakarta",
  metrics: [
    { value: "24", label: "Swing barrier lanes", shortLabel: "Lanes" },
    { value: "8,500", label: "Daily entries", shortLabel: "Daily entries" },
    { value: "3.1s", label: "Avg. entry time", shortLabel: "Avg. entry" },
  ],
};

export const secondaryProjects = [
  {
    slug: "rumah-sakit-medika-prima",
    image: images.corporateLobby,
    eyebrow: "Healthcare · Surabaya",
    title: "Rumah Sakit Medika Prima",
    description: "Flap barriers + visitor management for 3 hospital wings",
  },
  {
    slug: "sentra-mall-parking-hub",
    image: images.smartParkingMall,
    eyebrow: "Retail · Bandung",
    title: "Sentra Mall Parking Hub",
    description: "18 boom barriers with LPR and cashless payment across 4 levels",
  },
];

export const aboutChecks = [
  "In-house R&D for hardware, firmware and software",
  "Installation teams in 14 provinces",
  "ISO-aligned quality control on every unit",
];

/**
 * Hero copy and section headings (ERP-0071 stage 2). The ERP's home page overrides any of
 * them; `mobileTitle` / `mobileDescription` are the 390 frame's shorter variants and are
 * only used while the ERP has not set the heading.
 */
export type HomeHeading = { eyebrow: string; title: string; description?: string; mobileTitle?: string; mobileDescription?: string };

export const heroCopy = {
  badge: "EG-Face Pro 2 — contactless access in 0.2 seconds",
  badgeMobile: "EG-Face Pro 2 is here",
  badgeUrl: "/products/eg-face-pro-2",
  titleLead: "Smart Access.",
  titleAccent: "Seamless Automation.",
  titleTail: "Better Business.",
  description:
    "Integrated Hardware & Software Solutions for Modern Businesses — from the gate at your entrance to the dashboard on your screen.",
  mobileDescription: "Integrated Hardware & Software Solutions for Modern Businesses.",
  primaryCtaLabel: "Explore Products",
  primaryCtaUrl: "/products",
  secondaryCtaLabel: "Explore Solutions",
  secondaryCtaUrl: "/solutions",
  image: images.officeLobby,
};

export const homeHeadings: Record<
  "trusted" | "products" | "software" | "why" | "industries" | "projects" | "testimonials" | "about" | "contact",
  HomeHeading
> = {
  trusted: { eyebrow: "", title: "Trusted by leading organizations across Indonesia" },
  products: { eyebrow: "Featured Hardware", title: "Best-selling access hardware.", mobileTitle: "Best sellers" },
  software: { eyebrow: "Software Solutions", title: "Hardware that thinks. Software that connects it all." },
  why: {
    eyebrow: "Why Choose Entragate",
    title: "One partner from gate to dashboard.",
    description:
      "We design, manufacture, install and support every layer of your access infrastructure — so hardware and software work as one system, not a patchwork of vendors.",
  },
  industries: {
    eyebrow: "Industries We Serve",
    title: "Trusted at the entrances that matter.",
    description: "From corporate towers to stadiums, Entragate keeps millions of daily entries secure, fast and measurable.",
  },
  projects: { eyebrow: "Featured Projects", title: "Real installations. Measurable results." },
  testimonials: { eyebrow: "What Clients Say", title: "Trusted by the teams who run the entrances." },
  about: {
    eyebrow: "The Company Behind Entragate",
    title: "CV. Inti Multi Solusi — engineering smarter entrances since 2014.",
    description:
      "IMS is an Indonesian technology company specializing in smart access systems, automation hardware and integrated business software. Entragate is our product brand — combining in-house engineering, local manufacturing partners and a dedicated software team.",
    mobileTitle: "CV. Inti Multi Solusi",
    mobileDescription:
      "An Indonesian technology company specializing in smart access systems, automation hardware and integrated business software.",
  },
  contact: {
    eyebrow: "",
    title: "Let's build a smarter entrance.",
    description:
      "Tell us about your site. Our engineers will recommend the right hardware and software — with a detailed quotation within 24 hours.",
    mobileDescription: "Get a detailed quotation from our engineers within 24 hours.",
  },
};
