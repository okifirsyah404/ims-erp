import type { IconName } from "../lib/icons";
import { images } from "../lib/images";

/**
 * SAMPLE KNOWLEDGE CENTER CONTENT (01.03 Help & FAQ, 01.04 Documents & Downloads).
 * Copy follows the approved frames. Replace with CMS / ERP document records; file URLs
 * are not published yet, so downloads route to a document request.
 */

// ── Help topics & articles ────────────────────────────────────────────────
export type HelpTopic = { slug: string; title: string; mobileTitle?: string; description: string; icon: IconName };

export const helpTopics: HelpTopic[] = [
  { slug: "orders-delivery", title: "Orders & delivery", description: "Order status, shipping estimates, delivery to multiple sites and returns.", icon: "truck" },
  { slug: "quotations-payment", title: "Quotations & payment", description: "Requesting quotes, PO upload, virtual account payment and Faktur Pajak.", icon: "receipt" },
  { slug: "installation-survey", title: "Installation & site survey", mobileTitle: "Installation & survey", description: "Survey scheduling, site readiness checklist, cabling and commissioning.", icon: "construction" },
  { slug: "warranty-service", title: "Warranty & service", description: "Registering products, claims, SLA plans and preventive maintenance.", icon: "shield-check" },
  { slug: "platform", title: "Entragate platform", description: "Cloud dashboard, member app, face enrollment, QR passes and API.", icon: "layout-grid" },
  { slug: "account-team", title: "Account & team", description: "Business accounts, roles and permissions, invites and security.", icon: "users" },
];

export type HelpArticle = { slug: string; topic: string; title: string; summary: string; minutes: number; updated: string; body: string[] };

export const helpArticles: HelpArticle[] = [
  {
    slug: "track-your-order",
    topic: "orders-delivery",
    title: "Track your order from production to installation",
    summary: "Follow every stage of your order with the order number from your confirmation email.",
    minutes: 3,
    updated: "12 Oct 2026",
    body: [
      "Every Entragate order moves through seven stages: received, paid, production, quality control, shipped, installation and completed.",
      "Open Track Order and enter the order number from your confirmation email or invoice together with the phone number or email used at checkout. The page refreshes every 30 minutes.",
      "Business customers can see every order without an order number in the Customer Portal, including invoices, Faktur Pajak and installation schedules.",
    ],
  },
  {
    slug: "delivery-times",
    topic: "orders-delivery",
    title: "Delivery times and shipping areas",
    summary: "Ready-stock lead times for Jabodetabek and other provinces.",
    minutes: 2,
    updated: "03 Oct 2026",
    body: [
      "Stocked models (swing barriers, flap barriers, tripod turnstiles) ship within 5 business days in Jabodetabek and 7–10 days to other provinces.",
      "Pre-order models are produced in 3–4 weeks. Express delivery (1–2 working days) and same-day warehouse pickup in Bekasi are available at checkout.",
      "All freight is insured. Large orders can be split across several sites — add each address to your quotation request.",
    ],
  },
  {
    slug: "returns",
    topic: "orders-delivery",
    title: "Returns and damaged deliveries",
    summary: "What to do if a unit arrives damaged or you need to return it.",
    minutes: 2,
    updated: "21 Sep 2026",
    body: [
      "Inspect the crates on delivery and note any visible damage on the courier's receipt.",
      "Report damage within 48 hours from the Customer Portal or by WhatsApp with photos of the crate and the unit. We replace damaged units at no cost.",
      "Unopened ready-stock items can be returned within 14 days; custom finishes and project orders are non-returnable.",
    ],
  },
  {
    slug: "request-quotation",
    topic: "quotations-payment",
    title: "Request a formal quotation",
    summary: "Get volume pricing, installation and a site survey in one quotation.",
    minutes: 3,
    updated: "10 Oct 2026",
    body: [
      "Add products to your request from the catalog or Build Your Solution, then complete the project details on the RFQ page.",
      "Our sales engineers reply within one working day with a quotation PDF, which you can approve in the Customer Portal.",
      "Projects of four lanes or more qualify for volume pricing of up to 12%.",
    ],
  },
  {
    slug: "faktur-pajak",
    topic: "quotations-payment",
    title: "Getting a Faktur Pajak for your purchase",
    summary: "How tax invoices are issued for business customers.",
    minutes: 2,
    updated: "15 Sep 2026",
    body: [
      "Enable “Issue Faktur Pajak” at checkout and enter your company NPWP. For quotations, add the NPWP to your company profile in the Customer Portal.",
      "The Faktur Pajak is issued within 3 working days of full payment and is available to download from the Customer Portal.",
    ],
  },
  {
    slug: "payment-methods",
    topic: "quotations-payment",
    title: "Payment methods and NET 14 invoices",
    summary: "Virtual accounts, QRIS, cards and credit terms for business accounts.",
    minutes: 2,
    updated: "02 Sep 2026",
    body: [
      "We accept BCA and Mandiri virtual accounts, QRIS, and Visa, Mastercard and JCB cards. Virtual-account payments are verified instantly.",
      "Business accounts can apply for NET 14 invoice terms, subject to credit approval.",
    ],
  },
  {
    slug: "site-survey",
    topic: "installation-survey",
    title: "Preparing for a site survey",
    summary: "What our engineers check and how to prepare your site.",
    minutes: 4,
    updated: "08 Oct 2026",
    body: [
      "Surveys are free in Jabodetabek and take 1–2 hours per entrance group. Our engineer measures lanes, power, network and cable routes.",
      "Please prepare floor plans, the number of users or daily visitors, and contact details for building management.",
      "You receive a survey report and updated quotation within 2 working days.",
    ],
  },
  {
    slug: "installation-checklist",
    topic: "installation-survey",
    title: "Site readiness checklist before installation",
    summary: "Power, network and civil works needed before our team arrives.",
    minutes: 3,
    updated: "28 Sep 2026",
    body: [
      "Each lane needs a 220V outlet on a dedicated MCB and a CAT6 network point. Floors must be level within 3 mm.",
      "Conduits from the control room to each lane should be in place. Our team handles core drilling and anchoring.",
      "Installation usually takes 1–3 days per entrance group, followed by commissioning and operator training.",
    ],
  },
  {
    slug: "warranty-coverage",
    topic: "warranty-service",
    title: "What the standard warranty covers",
    summary: "Two-year warranty on parts and labour, with options to extend.",
    minutes: 3,
    updated: "11 Oct 2026",
    body: [
      "Entragate hardware carries a two-year warranty on parts, components and on-site labour within Jabodetabek, plus lifetime firmware updates.",
      "Damage from power surges or vandalism is not covered, but can be added with an optional protection plan.",
      "Extend coverage to five years from the Customer Portal or your account manager.",
    ],
  },
  {
    slug: "warranty-claim",
    topic: "warranty-service",
    title: "Raising a warranty claim",
    summary: "Open a claim in minutes from the Customer Portal.",
    minutes: 2,
    updated: "30 Sep 2026",
    body: [
      "Register your device first by scanning the QR label in the Customer Portal.",
      "Open the device, choose “Claim warranty”, describe the issue and attach photos or videos. Urgent tickets receive a reply within one hour.",
    ],
  },
  {
    slug: "face-enrollment",
    topic: "platform",
    title: "Enrolling faces in Entragate Cloud",
    summary: "Bulk-enrol staff and members from photos or the member app.",
    minutes: 4,
    updated: "05 Oct 2026",
    body: [
      "Upload a CSV with photos, or invite people to self-enrol from the member app. Enrolled faces sync to every terminal within a minute.",
      "Liveness detection rejects photos of photos and screens, so self-enrolment is safe for members and visitors.",
    ],
  },
  {
    slug: "api-integrations",
    topic: "platform",
    title: "Integrating with HR and membership systems",
    summary: "Use the REST API and webhooks to sync people and events.",
    minutes: 5,
    updated: "18 Sep 2026",
    body: [
      "Entragate exposes a documented REST API and webhooks for people, credentials and access events.",
      "Common integrations include HRIS (Talenta, Mekari), membership and billing systems, and payment gateways. Our engineers can build the connector for you.",
    ],
  },
  {
    slug: "team-roles",
    topic: "account-team",
    title: "Inviting team members and setting roles",
    summary: "Approvers, finance and viewers on one company account.",
    minutes: 2,
    updated: "01 Oct 2026",
    body: [
      "Business accounts can invite colleagues from Company & team in the Customer Portal.",
      "Approvers can accept quotations, Finance sees invoices and payments, and Viewers can track orders and tickets.",
    ],
  },
  {
    slug: "account-security",
    topic: "account-team",
    title: "Keeping your account secure",
    summary: "Passwords, sign-in alerts and removing access for leavers.",
    minutes: 2,
    updated: "19 Sep 2026",
    body: [
      "Use a password of at least 12 characters. You receive an email whenever your account signs in from a new device.",
      "Remove leavers from Company & team — their sessions end immediately.",
    ],
  },
];

export const popularSearches = ["Track my order", "Request Faktur Pajak", "Warranty claim", "Reset gate controller", "Add team members"];

// ── FAQ ───────────────────────────────────────────────────────────────────
export type FaqItem = { question: string; answer: string; links?: { label: string; href: string; icon: "route" | "book-open" }[] };
export type FaqGroup = { key: string; label: string; mobileLabel: string; items: FaqItem[] };

export const faqGroups: FaqGroup[] = [
  {
    key: "general",
    label: "General",
    mobileLabel: "General",
    items: [
      {
        question: "How long does delivery and installation take?",
        answer:
          "Stocked models (swing barriers, flap barriers, tripod turnstiles) ship within 5 business days in Jabodetabek and 7–10 days to other provinces. Installation is scheduled after the site survey and usually takes 1–3 days per entrance group. You can follow every step in Order Tracking.",
        links: [
          { label: "Open Order Tracking", href: "/track", icon: "route" },
          { label: "Read delivery guide", href: "/help/articles/delivery-times", icon: "book-open" },
        ],
      },
      {
        question: "Can I get a Faktur Pajak for my purchase?",
        answer: "Yes. Enable “Issue Faktur Pajak” at checkout or add your NPWP to your company profile. It is issued within 3 working days of full payment.",
        links: [{ label: "Faktur Pajak guide", href: "/help/articles/faktur-pajak", icon: "book-open" }],
      },
      {
        question: "What does the standard warranty cover?",
        answer: "Two years on parts, components and on-site labour within Jabodetabek, plus lifetime firmware updates. Power-surge and vandalism damage can be covered with an optional plan.",
        links: [{ label: "Warranty details", href: "/help/articles/warranty-coverage", icon: "book-open" }],
      },
      {
        question: "How do I raise a support ticket?",
        answer: "Open a ticket in the Customer Portal under Support → New ticket, or WhatsApp our 24/7 line. Attach photos or videos so our engineers can diagnose remotely.",
      },
      {
        question: "Can multiple people from my company use one account?",
        answer: "Yes. Business accounts can invite approvers, finance staff and viewers, each with their own login and permissions.",
        links: [{ label: "Team roles", href: "/help/articles/team-roles", icon: "book-open" }],
      },
      {
        question: "Does Entragate integrate with our existing HR or membership system?",
        answer: "Yes — through our REST API and webhooks. We regularly integrate with HRIS, membership, billing and payment systems, and can build the connector for you.",
        links: [{ label: "Integration guide", href: "/help/articles/api-integrations", icon: "book-open" }],
      },
      {
        question: "Do you offer site surveys outside Jakarta?",
        answer: "Yes. Surveys are free in Jabodetabek; elsewhere our Surabaya, Medan and Makassar teams survey sites for a travel fee that is deducted from your order.",
      },
    ],
  },
  {
    key: "orders",
    label: "Orders & delivery",
    mobileLabel: "Orders",
    items: [
      { question: "Can I deliver to several sites in one order?", answer: "Yes — add each site to your quotation request and we split delivery and installation per site." },
      { question: "Can I pick up from your warehouse?", answer: "Yes, choose Warehouse pickup at checkout to collect from Bekasi on the same day." },
      { question: "What if my delivery arrives damaged?", answer: "Report it within 48 hours with photos and we replace the damaged unit at no cost." },
    ],
  },
  {
    key: "payments",
    label: "Payments & tax",
    mobileLabel: "Payments",
    items: [
      { question: "Which payment methods do you accept?", answer: "BCA and Mandiri virtual accounts, QRIS, Visa, Mastercard and JCB. Business accounts can apply for NET 14 invoices." },
      { question: "Do prices include PPN?", answer: "Catalog prices exclude PPN 11%, which is added at checkout and on quotations." },
      { question: "Can we pay with a down payment?", answer: "Project orders use milestone payments — typically 50% down payment, with the balance due before shipping." },
    ],
  },
  {
    key: "warranty",
    label: "Warranty & service",
    mobileLabel: "Warranty",
    items: [
      { question: "How do I register my device?", answer: "Scan the QR label on the device in the Customer Portal to activate its warranty." },
      { question: "Do you offer maintenance contracts?", answer: "Yes. Preventive maintenance plans include scheduled visits, priority response and discounted spare parts." },
      { question: "How fast do you respond to urgent faults?", answer: "Urgent tickets receive a first reply within one hour, and on-site response within 24 hours in Jabodetabek." },
    ],
  },
  {
    key: "platform",
    label: "Platform & app",
    mobileLabel: "Platform",
    items: [
      { question: "Is the software cloud or on-premise?", answer: "Both. Entragate Cloud is hosted in Indonesian data centres; on-premise servers are available for government and high-security sites." },
      { question: "Does the gate still work if the internet is down?", answer: "Yes. Controllers store credentials and events locally and sync when the connection returns." },
      { question: "Is there a member or staff app?", answer: "Yes — the Entragate app provides QR passes, face enrolment and visitor invites on Android and iOS." },
    ],
  },
];

// ── Documents & downloads ─────────────────────────────────────────────────
export type DocType = "datasheet" | "manual" | "driver" | "certificate" | "cad" | "firmware";
export type DocFormat = "pdf" | "zip" | "dwg";

export const docTypes: { value: DocType; label: string; mobileLabel: string; icon: IconName }[] = [
  { value: "datasheet", label: "Datasheets", mobileLabel: "Datasheets", icon: "layers" },
  { value: "manual", label: "Manuals", mobileLabel: "Manuals", icon: "book-open" },
  { value: "driver", label: "Drivers & SDK", mobileLabel: "Drivers", icon: "code" },
  { value: "certificate", label: "Certificates", mobileLabel: "Certificates", icon: "badge-check" },
  { value: "cad", label: "CAD & drawings", mobileLabel: "CAD", icon: "crosshair" },
  { value: "firmware", label: "Firmware", mobileLabel: "Firmware", icon: "cpu" },
];

export const docCategories = [
  { slug: "flap-barrier-gate", label: "Flap Barrier Gate" },
  { slug: "swing-barrier-gate", label: "Swing Barrier Gate" },
  { slug: "tripod-turnstile", label: "Tripod Turnstile" },
  { slug: "parking-barrier", label: "Parking Barrier" },
  { slug: "face-recognition", label: "Face Recognition" },
  { slug: "rfid-qr-scanner", label: "RFID & QR Scanner" },
  { slug: "access-controllers", label: "Access Controllers" },
];

export const docLanguages = [
  { value: "en", label: "English" },
  { value: "id", label: "Bahasa Indonesia" },
];

export const docFormats: { value: DocFormat; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "zip", label: "ZIP / installer" },
  { value: "dwg", label: "DWG / STEP" },
];

export type DocumentRecord = {
  id: string;
  title: string;
  product: string;
  category: string;
  languages: ("en" | "id")[];
  type: DocType;
  version: string;
  size: string;
  format: DocFormat;
  updated: string; // ISO date
  partner?: boolean;
  /** Public file URL once the ERP/CDN publishes it. */
  url?: string;
};

export const documents: DocumentRecord[] = [
  { id: "fb500-datasheet", title: "FB500 Flap Barrier — Product Datasheet", product: "Flap Barrier FB500", category: "flap-barrier-gate", languages: ["en"], type: "datasheet", version: "Rev. 4.1", size: "2.4 MB PDF", format: "pdf", updated: "2026-10-12" },
  { id: "fb500-manual", title: "FB500 Installation & Commissioning Manual", product: "Flap Barrier FB500", category: "flap-barrier-gate", languages: ["id", "en"], type: "manual", version: "Rev. 3.0", size: "18.6 MB PDF", format: "pdf", updated: "2026-10-03" },
  { id: "access-sdk", title: "Entragate Access SDK for Windows & Linux", product: "FR-8 · QR-2 · AC-4 controllers", category: "access-controllers", languages: ["en"], type: "driver", version: "v4.2.0", size: "64 MB ZIP", format: "zip", updated: "2026-09-28", partner: true },
  { id: "barrier-conformity", title: "SNI & CE Declaration of Conformity — Barrier Series", product: "FB500 · SB300 · TT200", category: "flap-barrier-gate", languages: ["en", "id"], type: "certificate", version: "2026", size: "860 KB PDF", format: "pdf", updated: "2026-09-15" },
  { id: "fb500-footprint", title: "FB500 Cabinet Footprint & Lane Layout", product: "Flap Barrier FB500 · DWG + STEP", category: "flap-barrier-gate", languages: ["en"], type: "cad", version: "Rev. B", size: "12.1 MB ZIP", format: "dwg", updated: "2026-09-02", partner: true },
  { id: "fr8-firmware", title: "FR-8 Pro Firmware Update", product: "Face Recognition FR-8 Pro", category: "face-recognition", languages: ["en"], type: "firmware", version: "v3.2.1", size: "38 MB BIN", format: "zip", updated: "2026-08-26", partner: true },
  { id: "sb300-datasheet", title: "SB300 Swing Barrier — Product Datasheet", product: "Swing Barrier SB300", category: "swing-barrier-gate", languages: ["en"], type: "datasheet", version: "Rev. 2.6", size: "1.9 MB PDF", format: "pdf", updated: "2026-08-19" },
  { id: "pb600-wiring", title: "Parking Barrier PB600 Wiring Diagram", product: "Parking Barrier PB600", category: "parking-barrier", languages: ["id"], type: "manual", version: "Rev. 1.4", size: "3.2 MB PDF", format: "pdf", updated: "2026-08-07" },
  { id: "sb300-manual", title: "SB300 Installation Manual", product: "Swing Barrier SB300", category: "swing-barrier-gate", languages: ["id", "en"], type: "manual", version: "Rev. 2.1", size: "14.2 MB PDF", format: "pdf", updated: "2026-07-30" },
  { id: "tt200-datasheet", title: "TT200 Tripod Turnstile — Product Datasheet", product: "Tripod Turnstile TT200", category: "tripod-turnstile", languages: ["en"], type: "datasheet", version: "Rev. 3.3", size: "1.6 MB PDF", format: "pdf", updated: "2026-07-22" },
  { id: "tt200-cad", title: "TT200 Footprint & Anchoring Drawing", product: "Tripod Turnstile TT200 · DWG", category: "tripod-turnstile", languages: ["en"], type: "cad", version: "Rev. C", size: "6.8 MB ZIP", format: "dwg", updated: "2026-07-15", partner: true },
  { id: "fr8-datasheet", title: "Face Recognition FR-8 Pro — Datasheet", product: "Face Recognition FR-8 Pro", category: "face-recognition", languages: ["en", "id"], type: "datasheet", version: "Rev. 5.0", size: "2.1 MB PDF", format: "pdf", updated: "2026-07-09" },
  { id: "fr8-hris", title: "FR-8 HRIS API Integration Guide", product: "Face Recognition FR-8 Pro", category: "face-recognition", languages: ["en"], type: "manual", version: "v4.2", size: "4.4 MB PDF", format: "pdf", updated: "2026-07-01" },
  { id: "fr8-sni", title: "FR-8 SNI Certificate", product: "Face Recognition FR-8 Pro", category: "face-recognition", languages: ["id"], type: "certificate", version: "2026", size: "540 KB PDF", format: "pdf", updated: "2026-06-24" },
  { id: "pb600-datasheet", title: "Parking Barrier PB600 — Datasheet", product: "Parking Barrier PB600", category: "parking-barrier", languages: ["en"], type: "datasheet", version: "Rev. 2.2", size: "1.8 MB PDF", format: "pdf", updated: "2026-06-18" },
  { id: "pb600-loop", title: "Loop Detector Installation Guide", product: "Parking Barrier PB600", category: "parking-barrier", languages: ["id", "en"], type: "manual", version: "Rev. 1.2", size: "5.1 MB PDF", format: "pdf", updated: "2026-06-10" },
  { id: "pb600-firmware", title: "PB600 Controller Firmware", product: "Parking Barrier PB600", category: "parking-barrier", languages: ["en"], type: "firmware", version: "v2.7.0", size: "12 MB BIN", format: "zip", updated: "2026-06-02", partner: true },
  { id: "qr2-datasheet", title: "QR-2 Reader — Datasheet", product: "RFID & QR Reader QR-2", category: "rfid-qr-scanner", languages: ["en"], type: "datasheet", version: "Rev. 1.9", size: "1.1 MB PDF", format: "pdf", updated: "2026-05-27" },
  { id: "qr2-driver", title: "QR-2 Wiegand Configuration Tool", product: "RFID & QR Reader QR-2", category: "rfid-qr-scanner", languages: ["en"], type: "driver", version: "v1.6.3", size: "22 MB ZIP", format: "zip", updated: "2026-05-20" },
  { id: "ac4-manual", title: "AC-4 Controller Installation Manual", product: "Access Controller AC-4", category: "access-controllers", languages: ["id", "en"], type: "manual", version: "Rev. 2.4", size: "9.8 MB PDF", format: "pdf", updated: "2026-05-12" },
  { id: "ac4-datasheet", title: "AC-4 Controller — Datasheet", product: "Access Controller AC-4", category: "access-controllers", languages: ["en"], type: "datasheet", version: "Rev. 2.0", size: "1.3 MB PDF", format: "pdf", updated: "2026-05-05" },
  { id: "ac4-ce", title: "AC-4 CE Declaration of Conformity", product: "Access Controller AC-4", category: "access-controllers", languages: ["en"], type: "certificate", version: "2025", size: "620 KB PDF", format: "pdf", updated: "2026-04-28" },
  { id: "ctrl-firmware", title: "Controller Firmware FB-CTRL", product: "Flap Barrier FB500", category: "flap-barrier-gate", languages: ["en"], type: "firmware", version: "v3.2.1", size: "22 MB BIN", format: "zip", updated: "2026-04-21", partner: true },
  { id: "iso9001", title: "ISO 9001:2015 Quality Management Certificate", product: "CV. Inti Multi Solusi", category: "flap-barrier-gate", languages: ["en"], type: "certificate", version: "2025", size: "480 KB PDF", format: "pdf", updated: "2026-04-14" },
];

export const docKits = [
  { title: "Flap Barrier FB500", files: 9, contents: "Datasheet, install manual, wiring, CAD, CE cert", size: "ZIP · 48 MB", image: images.flapBarrier, category: "flap-barrier-gate" },
  { title: "Face Recognition FR-8 Pro", files: 7, contents: "Datasheet, SDK v4.2, HRIS API guide, SNI cert", size: "ZIP · 36 MB", image: images.faceTerminal, category: "face-recognition" },
  { title: "Parking Barrier PB600", files: 8, contents: "Datasheet, loop detector guide, firmware 2.7", size: "ZIP · 41 MB", image: images.parkingBarrier, category: "parking-barrier" },
];

export const docSortOptions = [
  { value: "updated", label: "Recently updated" },
  { value: "title", label: "Name A–Z" },
  { value: "type", label: "Document type" },
] as const;

// ── Video guides & training ───────────────────────────────────────────────
export const videoGuides = [
  { title: "Installing a flap barrier lane", duration: "12:40", topic: "Installation", image: images.flapBarrier },
  { title: "Enrolling faces on the FR-8 terminal", duration: "6:15", topic: "Face recognition", image: images.faceTerminal },
  { title: "Setting up visitor passes in Entragate Cloud", duration: "8:02", topic: "Platform", image: images.officeReception },
  { title: "Calibrating a parking barrier loop detector", duration: "9:30", topic: "Parking", image: images.parkingBarrier },
  { title: "Wiring an AC-4 controller", duration: "11:18", topic: "Controllers", image: images.accessController },
  { title: "Running daily gate reports", duration: "4:45", topic: "Platform", image: images.officeLobby },
];

export const trainingCourses = [
  { title: "Entragate Certified Installer", level: "Technician", duration: "2 days · on-site in Bekasi", description: "Mechanical installation, wiring, commissioning and safety checks for barriers and turnstiles.", icon: "wrench" as IconName },
  { title: "Entragate Cloud Administrator", level: "Operator", duration: "1 day · online", description: "People, credentials, access rules, visitor passes, reports and alerts.", icon: "cloud" as IconName },
  { title: "Integration Developer", level: "Developer", duration: "1 day · online", description: "REST API, webhooks, SDKs and HRIS / membership integrations.", icon: "code" as IconName },
  { title: "Preventive Maintenance", level: "Technician", duration: "1 day · on-site", description: "Quarterly maintenance routines, diagnostics and spare-part replacement.", icon: "shield-check" as IconName },
];
