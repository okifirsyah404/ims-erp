import { images } from "../lib/images";

/**
 * SAMPLE PORTFOLIO (01.02 Project Portfolio + case-study pages). Copy and figures come
 * from the approved frames; replace with CMS/ERP project records when available.
 */

export type Industry = "office" | "parking" | "education" | "fitness" | "venues" | "government";

export const industryFilters: { value: Industry | "all"; label: string; mobileLabel?: string; mobile?: boolean }[] = [
  { value: "all", label: "All industries", mobileLabel: "All", mobile: true },
  { value: "office", label: "Office", mobile: true },
  { value: "parking", label: "Parking", mobile: true },
  { value: "education", label: "Education", mobile: true },
  { value: "fitness", label: "Fitness" },
  { value: "venues", label: "Venues", mobile: true },
  { value: "government", label: "Government" },
];

export type Project = {
  slug: string;
  industry: Industry;
  /** Uppercase eyebrow on cards, e.g. "Parking · Retail". */
  eyebrow: string;
  title: string;
  client: string;
  location: string;
  year: number;
  /** One-line card meta. */
  meta: string;
  summary: string;
  image: string;
  gallery: string[];
  metrics: { value: string; label: string }[];
  challenge: string;
  solution: string;
  outcome: string;
  scope: string[];
  /** Catalog products used (links to product pages). */
  products: string[];
  /** Software solutions used (links to solution pages). */
  solutions: string[];
  quote?: { text: string; author: string; role: string };
  featured?: boolean;
};

export const projects: Project[] = [
  {
    slug: "grand-indonesia-smart-parking",
    industry: "parking",
    eyebrow: "Parking · Retail",
    title: "Smart Parking System",
    client: "Grand Indonesia Tower B",
    location: "Jakarta Pusat",
    year: 2026,
    meta: "Grand Indonesia Tower B · 1,200 bays · ANPR · guidance",
    summary:
      "Grand Indonesia Tower B — 1,200 bays upgraded with ANPR entry, parking guidance and cashless exit, live in 10 weeks without closing the basement.",
    image: images.parkingEntrance,
    gallery: [images.parkingEntrance, images.smartParkingMall, images.parkingBarrier, images.parkingKiosk],
    metrics: [
      { value: "-62%", label: "Exit queue time" },
      { value: "1.5 s", label: "Gate open time" },
      { value: "10 wks", label: "Install, zero downtime" },
    ],
    challenge:
      "Ticket-based entry created 15-minute exit queues at weekday peaks, and the operator had no live view of occupancy across four basement levels.",
    solution:
      "We replaced ticket dispensers with ANPR cameras at 6 entry lanes, added bay-level guidance displays and installed QRIS / e-money exit kiosks — phased lane by lane so the basement never closed.",
    outcome:
      "Exit queues fell by 62%, revenue reconciliation is automatic, and tenants now see live availability on the building app.",
    scope: ["6 entry + 6 exit lanes", "ANPR cameras", "Bay guidance displays", "Cashless exit kiosks", "Smart Parking software"],
    products: ["eg-park-b6-boom", "eg-pay-k5-exit-kiosk", "eg-kiosk-k2-ticket-dispenser"],
    solutions: ["smart-parking"],
    quote: { text: "We went cashless without closing a single level. Our tenants noticed the difference in the first week.", author: "Yudi Prasetyo", role: "Building Manager, Grand Indonesia Tower B" },
    featured: true,
  },
  {
    slug: "universitas-merdeka-campus-access",
    industry: "education",
    eyebrow: "Education",
    title: "Campus Access Control",
    client: "Universitas Merdeka",
    location: "Malang",
    year: 2025,
    meta: "Universitas Merdeka · 48 lanes · face recognition",
    summary: "48 flap lanes with face recognition across library, faculty buildings and dormitories — one identity for 32,000 students.",
    image: images.transitTurnstiles,
    gallery: [images.transitTurnstiles, images.campusLobby, images.flapBarrier, images.faceTerminal],
    metrics: [
      { value: "48", label: "Flap lanes" },
      { value: "32k", label: "Students enrolled" },
      { value: "0.3 s", label: "Face match" },
    ],
    challenge: "Shared student cards were passed between friends, and the library had no reliable visitor count.",
    solution: "Face recognition terminals on every flap lane, synced with the academic system, plus Library Management for loans and occupancy.",
    outcome: "Card sharing stopped overnight, and the library now reports live occupancy to the campus app.",
    scope: ["48 flap barrier lanes", "Face recognition terminals", "Library Management", "Campus identity sync"],
    products: ["eg-flap-f150-slim", "eg-face-pro-2"],
    solutions: ["library-management", "access-control"],
  },
  {
    slug: "fitzone-member-check-in",
    industry: "fitness",
    eyebrow: "Fitness",
    title: "Member Check-in Turnstiles",
    client: "fitzone",
    location: "Jabodetabek",
    year: 2025,
    meta: "fitzone · 22 clubs · QR & app check-in",
    summary: "Tripod turnstiles with QR and app check-in at 22 clubs, connected to Gym Management for memberships and billing.",
    image: images.hotelLobby,
    gallery: [images.hotelLobby, images.tripodTurnstile, images.accessTerminal],
    metrics: [
      { value: "22", label: "Clubs" },
      { value: "4 s", label: "Average check-in" },
      { value: "-18%", label: "Expired-member visits" },
    ],
    challenge: "Front desks spent peak hours checking cards by hand, and expired members slipped in unnoticed.",
    solution: "QR and app check-in at tripod turnstiles, with membership status checked in real time by Entragate Gym Management.",
    outcome: "Check-in takes under 4 seconds and renewal reminders are sent automatically at the gate.",
    scope: ["44 tripod turnstiles", "QR & RFID readers", "Gym Management", "Member app"],
    products: ["eg-tri-t100", "eg-scan-q3"],
    solutions: ["gym-management"],
  },
  {
    slug: "gelora-arena-ticketing",
    industry: "venues",
    eyebrow: "Sports & Venues",
    title: "Stadium Ticketing Gates",
    client: "Gelora Arena",
    location: "Jakarta",
    year: 2024,
    meta: "Gelora Arena · 96 tripod lanes · 40,000 fans",
    summary: "96 tripod lanes validating e-tickets for 40,000 fans, with live capacity per gate for the control room.",
    image: images.stadiumEntrance,
    gallery: [images.stadiumEntrance, images.tripodTurnstile, images.transitTurnstiles],
    metrics: [
      { value: "96", label: "Tripod lanes" },
      { value: "40k", label: "Fans per match" },
      { value: "35 min", label: "Full-stadium entry" },
    ],
    challenge: "Paper tickets were forged, and gates had no live count — the control room learned about overcrowding from the stands.",
    solution: "E-Ticketing with dynamic QR passes validated at outdoor-rated tripod turnstiles, and a live capacity dashboard per gate.",
    outcome: "Forgery disappeared, and the stadium fills in 35 minutes with operators steering crowds between gates.",
    scope: ["96 tripod turnstiles", "Dynamic QR tickets", "E-Ticketing", "Live capacity dashboard"],
    products: ["eg-tri-t300-auto", "eg-scan-q3"],
    solutions: ["e-ticketing"],
  },
  {
    slug: "bank-sentosa-visitor-management",
    industry: "office",
    eyebrow: "Finance",
    title: "HQ Visitor Management",
    client: "Bank Sentosa HQ",
    location: "Jakarta Selatan",
    year: 2025,
    meta: "Bank Sentosa HQ · Kiosk · speed gates · VMS",
    summary: "Self-service visitor kiosks and speed gates for a 30-floor bank headquarters, with host notifications and audit trails.",
    image: images.engineeringTeam,
    gallery: [images.engineeringTeam, images.officeReception, images.swingBarrierDouble],
    metrics: [
      { value: "1,800", label: "Visitors per day" },
      { value: "45 s", label: "Self check-in" },
      { value: "100%", label: "Audit coverage" },
    ],
    challenge: "Reception queues stretched into the lobby, and compliance needed a complete audit trail for every visitor.",
    solution: "Visitor Management with pre-registration, self-service kiosks and QR passes that open the swing gates only for the floor being visited.",
    outcome: "Lobby queues are gone and auditors receive monthly visitor reports automatically.",
    scope: ["Self-service kiosks", "8 swing gates", "Visitor Management", "Host notifications"],
    products: ["eg-swing-s200-glass", "eg-face-pro-2"],
    solutions: ["visitor-management"],
  },
  {
    slug: "graha-tower-lobby-speed-gates",
    industry: "office",
    eyebrow: "Office",
    title: "Lobby Speed Gates",
    client: "Graha Tower Phase 2",
    location: "Jakarta Selatan",
    year: 2026,
    meta: "Graha Tower Phase 2 · 12 swing gates · Access Cloud",
    summary: "12 glass swing gates managed from Entragate Access Cloud, sharing one tenant directory with Phase 1.",
    image: images.officeLobby,
    gallery: [images.officeLobby, images.swingBarrierDouble, images.swingGateHinge],
    metrics: [
      { value: "12", label: "Swing gates" },
      { value: "6,200", label: "Daily entries" },
      { value: "1", label: "Shared tenant directory" },
    ],
    challenge: "Phase 2 needed premium lobby gates that worked with the existing Phase 1 tenant cards.",
    solution: "Tempered-glass swing gates on Access Cloud, importing the Phase 1 directory so tenants use one credential across both towers.",
    outcome: "Tenants moved into Phase 2 without re-issuing a single card.",
    scope: ["12 swing barrier lanes", "Access Cloud", "Tenant self-service portal"],
    products: ["eg-swing-s200-glass", "eg-core-c4-controller"],
    solutions: ["access-control"],
  },
  {
    slug: "graha-nusantara-tower",
    industry: "office",
    eyebrow: "Corporate Office",
    title: "Graha Nusantara Tower — 24-lane smart lobby",
    client: "Graha Nusantara Tower",
    location: "Jakarta Selatan",
    year: 2026,
    meta: "Graha Nusantara · 24 swing lanes · 8,500 daily entries",
    summary: "A 24-lane smart lobby with swing barriers, face recognition and visitor management for 8,500 daily entries.",
    image: images.mallLobby,
    gallery: [images.mallLobby, images.swingBarrierDouble, images.faceTerminal],
    metrics: [
      { value: "24", label: "Swing barrier lanes" },
      { value: "8,500", label: "Daily entries" },
      { value: "3.1 s", label: "Avg. entry time" },
    ],
    challenge: "Morning peaks overwhelmed the old turnstiles and guards checked visitor passes by hand.",
    solution: "24 swing lanes with face recognition for tenants and QR passes for visitors, all managed from one dashboard.",
    outcome: "Average entry time dropped to 3.1 seconds, even at 8:00 peak.",
    scope: ["24 swing barrier lanes", "Face recognition", "Visitor Management"],
    products: ["eg-swing-s200-glass", "eg-face-pro-2"],
    solutions: ["visitor-management", "access-control"],
  },
  {
    slug: "rumah-sakit-medika-prima",
    industry: "office",
    eyebrow: "Healthcare · Surabaya",
    title: "Rumah Sakit Medika Prima",
    client: "Rumah Sakit Medika Prima",
    location: "Surabaya",
    year: 2025,
    meta: "Flap barriers + visitor management for 3 hospital wings",
    summary: "Flap barriers and visitor management across 3 hospital wings, with visiting-hour rules per ward.",
    image: images.corporateLobby,
    gallery: [images.corporateLobby, images.flapBarrier, images.officeReception],
    metrics: [
      { value: "3", label: "Hospital wings" },
      { value: "2", label: "Visitors per patient" },
      { value: "24/7", label: "Emergency override" },
    ],
    challenge: "Wards were crowded outside visiting hours and staff couldn't enforce visitor limits.",
    solution: "Visitor passes tied to each patient, enforced at flap barriers per wing, with a fire-alarm override for emergencies.",
    outcome: "Visitor limits are enforced automatically, and nurses no longer police the corridors.",
    scope: ["Flap barrier lanes", "Visitor Management", "Ward rules engine"],
    products: ["eg-flap-f150-slim", "eg-scan-q3"],
    solutions: ["visitor-management"],
  },
  {
    slug: "sentra-mall-parking-hub",
    industry: "parking",
    eyebrow: "Retail · Bandung",
    title: "Sentra Mall Parking Hub",
    client: "Sentra Mall",
    location: "Bandung",
    year: 2024,
    meta: "18 boom barriers with LPR and cashless payment across 4 levels",
    summary: "18 boom barriers with LPR and cashless payment across 4 levels.",
    image: images.smartParkingMall,
    gallery: [images.smartParkingMall, images.parkingBarrier, images.parkingKiosk],
    metrics: [
      { value: "18", label: "Boom barriers" },
      { value: "4", label: "Parking levels" },
      { value: "100%", label: "Cashless exit" },
    ],
    challenge: "Cash handling at exits caused long weekend queues and reconciliation errors.",
    solution: "LPR-based entry, cashless exit kiosks and Smart Parking software reconciling every transaction.",
    outcome: "Weekend exit queues disappeared and daily reconciliation is automatic.",
    scope: ["18 boom barriers", "LPR cameras", "Cashless kiosks", "Smart Parking"],
    products: ["eg-park-b4-straight", "eg-pay-k5-exit-kiosk"],
    solutions: ["smart-parking"],
  },
  {
    slug: "pemkot-surabaya-city-hall",
    industry: "government",
    eyebrow: "Government",
    title: "City Hall Visitor & Access",
    client: "Pemerintah Kota Surabaya",
    location: "Surabaya",
    year: 2025,
    meta: "City hall · 16 flap lanes · public service queue",
    summary: "Flap barriers, visitor kiosks and staff face recognition for a city hall serving 3,000 citizens a day.",
    image: images.campusLobby,
    gallery: [images.campusLobby, images.flapBarrier, images.faceTerminal],
    metrics: [
      { value: "16", label: "Flap lanes" },
      { value: "3,000", label: "Citizens per day" },
      { value: "TKDN", label: "Local content certified" },
    ],
    challenge: "Citizens and staff shared one entrance, with no record of who entered secure floors.",
    solution: "Separate staff lanes with face recognition and a visitor kiosk issuing QR passes for public-service floors — TKDN-certified hardware.",
    outcome: "Secure floors are restricted to staff, and every public visit is logged.",
    scope: ["16 flap barrier lanes", "Visitor kiosks", "Face recognition", "TKDN-compliant hardware"],
    products: ["eg-flap-f200-wide", "eg-face-lite-1"],
    solutions: ["visitor-management", "access-control"],
  },
];

export const portfolioStats = [
  { value: "1,200+", label: "Installations" },
  { value: "34", label: "Cities served" },
  { value: "99.2%", label: "Gate uptime SLA" },
  { value: "24/7", label: "Support coverage" },
];

/** Grid order on the portfolio page (01.02): six cards below the featured story. */
export const portfolioGrid = [
  "universitas-merdeka-campus-access",
  "fitzone-member-check-in",
  "gelora-arena-ticketing",
  "bank-sentosa-visitor-management",
  "graha-tower-lobby-speed-gates",
  "grand-indonesia-smart-parking",
];

export const getProject = (slug: string) => projects.find((p) => p.slug === slug);
