import type { IconName } from "../lib/icons";

/**
 * SAMPLE CONTENT for the solution detail pages (/solutions/[slug]). No dedicated frame
 * exists; copy extends the approved 02.04 card text. Replace with CMS content.
 */
export type SolutionDetail = {
  headline: string;
  intro: string;
  stats: { value: string; label: string }[];
  modules: { icon: IconName; title: string; description: string }[];
  workflow: { title: string; description: string }[];
  /** Catalog product slugs that pair with this software. */
  hardware: string[];
  /** Portfolio project slugs. */
  projects: string[];
  industries: string[];
  faq: { question: string; answer: string }[];
  pricingNote: string;
};

export const solutionDetails: Record<string, SolutionDetail> = {
  "gym-management": {
    headline: "Run every club from one dashboard — members walk in, expired passes stop at the gate.",
    intro:
      "Entragate Gym connects memberships, class bookings and billing to face-ID and QR turnstiles, so front desks stop checking cards and revenue leaks close automatically.",
    stats: [
      { value: "120+", label: "Gyms running Entragate" },
      { value: "4 s", label: "Average check-in" },
      { value: "-18%", label: "Expired-member visits" },
    ],
    modules: [
      { icon: "users", title: "Memberships & packages", description: "Monthly, annual, class packs and corporate plans with freezes and transfers." },
      { icon: "scan-face", title: "Face ID & QR check-in", description: "Members enrol once in the app; turnstiles verify status in real time." },
      { icon: "calendar-check", title: "Class bookings", description: "Schedules, waitlists and capacity limits per studio and coach." },
      { icon: "receipt", title: "Auto billing", description: "Recurring charges via virtual account, QRIS and cards with dunning reminders." },
      { icon: "smartphone", title: "Member app", description: "Passes, bookings, invoices and push notifications under your brand." },
      { icon: "layers", title: "Multi-club reports", description: "Attendance, revenue and churn per club, compared side by side." },
    ],
    workflow: [
      { title: "Join online", description: "Members pick a plan, pay and enrol their face in the app." },
      { title: "Walk in", description: "The turnstile checks membership status in under a second." },
      { title: "Book & train", description: "Class capacity and coach schedules update live." },
      { title: "Renew automatically", description: "Billing runs on schedule; expired passes are stopped at the gate." },
    ],
    hardware: ["eg-tri-t100", "eg-face-pro-2", "eg-scan-q3", "eg-flap-f150-slim"],
    projects: ["fitzone-member-check-in"],
    industries: ["Fitness chains", "Clubs & pools", "Corporate gyms", "Martial arts studios"],
    faq: [
      { question: "Can members use their existing cards?", answer: "Yes. Entragate reads Mifare and EM cards alongside face ID and QR, so you can migrate gradually." },
      { question: "Does it handle multiple clubs?", answer: "Yes — one account manages every club, with roaming rules per membership tier." },
      { question: "Can it integrate with our payment gateway?", answer: "We support major Indonesian gateways out of the box and expose a REST API for others." },
    ],
    pricingNote: "Per-club subscription · hardware sold separately or bundled",
  },
  "e-ticketing": {
    headline: "Sell, issue and scan tickets in one system — fraud-proof at every gate.",
    intro:
      "Entragate Tickets handles online sales, dynamic QR and RFID tickets, and sub-300 ms validation at flap barriers and turnstiles, with live capacity for the control room.",
    stats: [
      { value: "2.4M", label: "Tickets scanned" },
      { value: "<300 ms", label: "Validation at the gate" },
      { value: "0", label: "Forged tickets accepted" },
    ],
    modules: [
      { icon: "ticket", title: "Online ticket sales", description: "Seat maps, price tiers, promo codes and group bookings." },
      { icon: "qr-code", title: "Dynamic QR & RFID", description: "Rotating QR codes and RFID wristbands that can't be screenshotted or copied." },
      { icon: "zap", title: "Gate validation", description: "Offline-capable validation at every lane with anti-passback." },
      { icon: "eye", title: "Live capacity", description: "Entry counts per gate and zone for crowd control." },
      { icon: "receipt", title: "Payments & refunds", description: "QRIS, virtual accounts and cards with automated refunds." },
      { icon: "layout-grid", title: "Event reports", description: "Sales, no-shows and entry curves per event and gate." },
    ],
    workflow: [
      { title: "Publish the event", description: "Set zones, prices and gates in minutes." },
      { title: "Sell & issue", description: "Buyers receive dynamic QR tickets or wristbands." },
      { title: "Scan at the gate", description: "Turnstiles validate tickets in under 300 ms, even offline." },
      { title: "Monitor live", description: "Operators steer crowds with live gate counts." },
    ],
    hardware: ["eg-tri-t300-auto", "eg-flap-f200-wide", "eg-scan-q3", "eg-scan-r1-reader"],
    projects: ["gelora-arena-ticketing"],
    industries: ["Stadiums & arenas", "Theme parks", "Museums & attractions", "Conferences"],
    faq: [
      { question: "Does validation work without internet?", answer: "Yes. Gates cache valid tickets and sync scans when the connection returns." },
      { question: "Can we keep our ticketing partner?", answer: "Yes — we import tickets from partner platforms via API and validate them at our gates." },
      { question: "How do you stop ticket forgery?", answer: "Rotating QR codes and single-entry rules make screenshots and copies useless." },
    ],
    pricingNote: "Per-venue licence or per-ticket fee · volume pricing for stadiums",
  },
  "visitor-management": {
    headline: "Welcome visitors in seconds — and only to the floors they're invited to.",
    intro:
      "Entragate Visitor pre-registers guests, verifies ID at self-service kiosks and issues QR passes that open the right gates, with host alerts and a complete audit trail.",
    stats: [
      { value: "60+", label: "Office towers" },
      { value: "45 s", label: "Self check-in" },
      { value: "100%", label: "Audit coverage" },
    ],
    modules: [
      { icon: "calendar-check", title: "Pre-registration", description: "Hosts invite guests from email, the app or Outlook / Google Calendar." },
      { icon: "user-check", title: "Self-service kiosk", description: "ID scan, photo capture and NDA signing in under a minute." },
      { icon: "qr-code", title: "QR passes", description: "Passes open only the invited floor and expire automatically." },
      { icon: "message-circle", title: "Host alerts", description: "WhatsApp and email notifications when guests arrive." },
      { icon: "shield-check", title: "Watchlists", description: "Flag restricted visitors and alert security instantly." },
      { icon: "layers", title: "Audit & reports", description: "Every visit logged for compliance, exportable monthly." },
    ],
    workflow: [
      { title: "Invite", description: "The host registers the visitor and the floor they'll visit." },
      { title: "Check in", description: "The visitor scans ID at the kiosk and receives a QR pass." },
      { title: "Enter", description: "Speed gates open only for the invited floor." },
      { title: "Leave & log", description: "The pass expires and the visit is archived." },
    ],
    hardware: ["eg-swing-s200-glass", "eg-face-pro-2", "eg-scan-q3", "eg-flap-f150-slim"],
    projects: ["bank-sentosa-visitor-management", "rumah-sakit-medika-prima", "pemkot-surabaya-city-hall"],
    industries: ["Office towers", "Banks & finance", "Hospitals", "Government buildings"],
    faq: [
      { question: "Can visitors check in without a kiosk?", answer: "Yes — invited visitors can check in on their phone and walk straight to the gate." },
      { question: "Is ID data stored securely?", answer: "ID images are encrypted, hosted in Indonesia and deleted on your retention schedule." },
      { question: "Does it work with our existing gates?", answer: "In most cases yes — our engineers check compatibility during the site survey." },
    ],
    pricingNote: "Per-building subscription · kiosks available to buy or rent",
  },
  "library-management": {
    headline: "Self-service libraries with RFID loans, member gates and overdue alerts built in.",
    intro:
      "Entragate Library combines RFID cataloguing, self-service loans and returns, and member gates — so librarians spend time with readers, not scanners.",
    stats: [
      { value: "40+", label: "Campuses" },
      { value: "8 s", label: "Self-service loan" },
      { value: "-35%", label: "Overdue items" },
    ],
    modules: [
      { icon: "nfc", title: "RFID cataloguing", description: "Tag collections and run inventory with handheld readers." },
      { icon: "book-open", title: "Catalogue (OPAC)", description: "Search, holds and renewals on web and mobile." },
      { icon: "zap", title: "Self-service loans", description: "Kiosks issue and return several books at once." },
      { icon: "door-open", title: "Member gates", description: "Student ID or face entry with live occupancy." },
      { icon: "message-circle", title: "Overdue alerts", description: "Automatic reminders by WhatsApp and email." },
      { icon: "layers", title: "Usage analytics", description: "Visits, loans and popular titles per faculty." },
    ],
    workflow: [
      { title: "Tag the collection", description: "RFID tags link every item to the catalogue." },
      { title: "Enter", description: "Members pass the gate with their student card or face." },
      { title: "Borrow", description: "Self-service kiosks issue loans in seconds." },
      { title: "Return anywhere", description: "Drop boxes check items in and alert members automatically." },
    ],
    hardware: ["eg-flap-f150-slim", "eg-face-lite-1", "eg-scan-r1-reader", "eg-core-c2-controller"],
    projects: ["universitas-merdeka-campus-access"],
    industries: ["Universities", "Schools", "Public libraries", "Corporate libraries"],
    faq: [
      { question: "Can you migrate our existing catalogue?", answer: "Yes — we import MARC and spreadsheet catalogues and tag collections on site." },
      { question: "Does it integrate with the academic system?", answer: "Student data syncs from SIAKAD and other academic systems via API." },
      { question: "Do you supply RFID tags?", answer: "Yes, along with tagging stations and handheld inventory readers." },
    ],
    pricingNote: "Per-library subscription · RFID tags and kiosks quoted per collection",
  },
  "smart-parking": {
    headline: "Ticketless, cashless parking with live occupancy across every level and site.",
    intro:
      "Entragate Parking reads plates at entry, guides drivers to free bays and takes cashless payment at exit — reconciling every transaction automatically.",
    stats: [
      { value: "18K", label: "Bays managed" },
      { value: "-62%", label: "Exit queue time" },
      { value: "100%", label: "Cashless reconciliation" },
    ],
    modules: [
      { icon: "car", title: "License plate recognition", description: "ANPR tuned for Indonesian plates, day and night." },
      { icon: "square-parking", title: "Occupancy & guidance", description: "Bay sensors and signs show free spaces per level." },
      { icon: "receipt", title: "Cashless payment", description: "QRIS, e-money and cards at exit kiosks or in the app." },
      { icon: "users", title: "Members & tenants", description: "Monthly passes and tenant quotas with automatic billing." },
      { icon: "shield-check", title: "Revenue control", description: "Every entry and payment matched — no leakage." },
      { icon: "layers", title: "Multi-site reports", description: "Occupancy, revenue and dwell time per site." },
    ],
    workflow: [
      { title: "Drive in", description: "ANPR reads the plate and the barrier opens — no ticket." },
      { title: "Find a bay", description: "Guidance signs lead drivers to free spaces." },
      { title: "Pay", description: "Cashless at the kiosk, in the app or automatically for members." },
      { title: "Drive out", description: "The plate is matched to the payment and the barrier opens." },
    ],
    hardware: ["eg-park-b6-boom", "eg-park-b4-straight", "eg-pay-k5-exit-kiosk", "eg-kiosk-k2-ticket-dispenser"],
    projects: ["grand-indonesia-smart-parking", "sentra-mall-parking-hub"],
    industries: ["Malls & retail", "Office towers", "Hospitals", "Airports & transit"],
    faq: [
      { question: "Can we keep ticket dispensers for visitors?", answer: "Yes — mix ANPR for members with QR tickets for visitors." },
      { question: "Which payment methods are supported?", answer: "QRIS, e-money cards, debit/credit cards and in-app payment." },
      { question: "Can it run without closing the car park?", answer: "Yes. We migrate lane by lane, as in our Grand Indonesia project." },
    ],
    pricingNote: "Per-lane licence · hardware and installation quoted per site",
  },
  "access-control": {
    headline: "Every door, gate and credential — managed centrally across all your sites.",
    intro:
      "Entragate Access manages schedules, anti-passback, lockdown and audit trails for faces, cards and QR codes, with controllers that keep working offline.",
    stats: [
      { value: "5,000+", label: "Doors online" },
      { value: "1", label: "Identity per person" },
      { value: "24/7", label: "Local support" },
    ],
    modules: [
      { icon: "key-round", title: "Credentials", description: "Faces, cards, QR and mobile keys linked to one profile." },
      { icon: "calendar-check", title: "Schedules & zones", description: "Time rules per group, floor, door and holiday calendar." },
      { icon: "shield-check", title: "Anti-passback & lockdown", description: "Prevent shared credentials and lock zones in one click." },
      { icon: "flame", title: "Fire-alarm integration", description: "Doors release automatically on alarm." },
      { icon: "cloud", title: "Cloud or on-premise", description: "Hosted in Indonesia or on your own servers." },
      { icon: "code", title: "Open API", description: "Sync people from HRIS and push events to your systems." },
    ],
    workflow: [
      { title: "Enrol", description: "People are imported from HRIS or enrolled on site." },
      { title: "Assign access", description: "Rules grant doors and gates by role and schedule." },
      { title: "Enter", description: "Controllers decide locally in milliseconds, even offline." },
      { title: "Audit", description: "Every event is logged and searchable across sites." },
    ],
    hardware: ["eg-core-c4-controller", "eg-core-c2-controller", "eg-face-pro-2", "eg-lock-m600-maglock"],
    projects: ["graha-tower-lobby-speed-gates", "graha-nusantara-tower", "pemkot-surabaya-city-hall"],
    industries: ["Corporate offices", "Data centres", "Factories", "Government"],
    faq: [
      { question: "Can it control doors from other brands?", answer: "Many standard Wiegand and OSDP readers and locks work with Entragate controllers." },
      { question: "What happens if the network goes down?", answer: "Controllers store credentials and events locally and keep doors working." },
      { question: "Can we host it ourselves?", answer: "Yes — on-premise deployment is available for government and high-security sites." },
    ],
    pricingNote: "Per-door licence · controllers and readers quoted per site",
  },
};
