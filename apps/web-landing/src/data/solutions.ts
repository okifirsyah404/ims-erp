import type { IconName } from "../lib/icons";
import { images } from "../lib/images";

/** 02.04 Software Solutions content. Mockup data is illustrative UI, not live figures. */

export type PlatformKey = "gym" | "tickets" | "visitor" | "library" | "parking" | "access";

export type Platform = {
  key: PlatformKey;
  slug: string;
  name: string;
  /** Label in the integration "software layer" list. */
  layerLabel: string;
  mobileLayerLabel: string;
  chipLabel: string;
  windowTitle: string;
  icon: IconName;
  preview: "blue" | "cyan" | "gray";
  description: string;
  mobileDescription: string;
  tags: string[];
  mobileTags: string[];
  meta: string;
};

export const platforms: Platform[] = [
  {
    key: "gym",
    slug: "gym-management",
    name: "Gym Management System",
    layerLabel: "Gym Management",
    mobileLayerLabel: "Gym",
    chipLabel: "Gym",
    windowTitle: "Entragate Gym",
    icon: "dumbbell",
    preview: "blue",
    description:
      "Memberships, class bookings and auto-billing linked to face-ID turnstiles — members walk in, expired passes are stopped at the gate.",
    mobileDescription: "Memberships, class bookings and auto-billing linked to face-ID turnstiles.",
    tags: ["Memberships", "Face ID check-in", "Auto billing"],
    mobileTags: ["Memberships", "Face ID", "Auto billing"],
    meta: "Used by 120+ gyms",
  },
  {
    key: "tickets",
    slug: "e-ticketing",
    name: "E-Ticketing System",
    layerLabel: "E-Ticketing",
    mobileLayerLabel: "E-Ticketing",
    chipLabel: "Tickets",
    windowTitle: "Entragate Tickets",
    icon: "ticket",
    preview: "cyan",
    description:
      "Sell, issue and validate QR tickets for events, venues and attractions — scanned at flap barriers in under 300 ms, fraud-proof.",
    mobileDescription: "Sell, issue and validate QR tickets — scanned at flap barriers in under 300 ms.",
    tags: ["QR & RFID tickets", "Online sales", "Gate validation"],
    mobileTags: ["QR & RFID", "Online sales", "Gate scan"],
    meta: "2.4M tickets scanned",
  },
  {
    key: "visitor",
    slug: "visitor-management",
    name: "Visitor Management System",
    layerLabel: "Visitor Management",
    mobileLayerLabel: "Visitor",
    chipLabel: "Visitors",
    windowTitle: "Entragate Visitor",
    icon: "user-check",
    preview: "gray",
    description:
      "Pre-register guests, capture ID and photo at a self-service kiosk, and print QR passes that open only the floors they are invited to.",
    mobileDescription: "Pre-register guests, self check-in at kiosks and print QR passes for invited floors only.",
    tags: ["Self check-in kiosk", "Host alerts", "QR passes"],
    mobileTags: ["Kiosk", "Host alerts", "QR passes"],
    meta: "Deployed in 60+ towers",
  },
  {
    key: "library",
    slug: "library-management",
    name: "Library Management System",
    layerLabel: "Library Management",
    mobileLayerLabel: "Library",
    chipLabel: "Library",
    windowTitle: "Entragate Library",
    icon: "book-open",
    preview: "blue",
    description:
      "RFID cataloguing, self-service loans and returns, and member gates for campuses and public libraries — with overdue alerts built in.",
    mobileDescription: "RFID cataloguing, self-service loans and member gates with overdue alerts built in.",
    tags: ["RFID self-loan", "Catalogue (OPAC)", "Member gates"],
    mobileTags: ["RFID loans", "OPAC", "Member gates"],
    meta: "40+ campuses",
  },
  {
    key: "parking",
    slug: "smart-parking",
    name: "Smart Parking Software",
    layerLabel: "Smart Parking",
    mobileLayerLabel: "Parking",
    chipLabel: "Parking",
    windowTitle: "Entragate Parking",
    icon: "car",
    preview: "cyan",
    description:
      "Ticketless entry with LPR and RFID, real-time slot occupancy, cashless payment and revenue reports across every level and site.",
    mobileDescription: "Ticketless LPR entry, live slot occupancy and cashless payments across every level.",
    tags: ["License plate (LPR)", "Cashless", "Occupancy map"],
    mobileTags: ["LPR", "Cashless", "Occupancy"],
    meta: "18K slots managed",
  },
  {
    key: "access",
    slug: "access-control",
    name: "Access Control Software",
    layerLabel: "Access Control",
    mobileLayerLabel: "Access",
    chipLabel: "Access",
    windowTitle: "Entragate Access",
    icon: "key-round",
    preview: "gray",
    description:
      "Centrally manage doors, gates and credentials — schedules, anti-passback, lockdown and audit trails for every face, card and QR.",
    mobileDescription: "Manage doors, gates and credentials centrally — schedules, anti-passback and audit trails.",
    tags: ["Multi-site", "Anti-passback", "Audit trail"],
    mobileTags: ["Multi-site", "Anti-passback", "Audit"],
    meta: "5,000+ doors online",
  },
];

export const hardwareLayer = [
  { label: "Swing & Flap Barriers", image: images.flapBarrier, mobileLabel: "Barriers" },
  { label: "Tripod Turnstiles", image: images.tripodTurnstile, mobileLabel: "Turnstiles" },
  { label: "Parking Barriers & LPR", image: images.parkingBarrier, mobileLabel: "Parking & LPR" },
  { label: "Face Recognition Terminals", image: images.faceTerminal, mobileLabel: "Face ID" },
  { label: "RFID / QR Readers & Controllers", image: images.accessController },
];

export const integrationBenefits: { icon: IconName; title: string; description: string; mobileDescription: string }[] = [
  {
    icon: "zap",
    title: "Real-time sync",
    description: "Events reach dashboards in under a second, even across sites.",
    mobileDescription: "Events reach dashboards in under a second.",
  },
  {
    icon: "contact",
    title: "Single identity",
    description: "One profile per person — face, card, QR and plate linked together.",
    mobileDescription: "Face, card, QR and plate linked to one profile.",
  },
  {
    icon: "code",
    title: "Open REST API",
    description: "Connect ERP, HRIS or payment gateways with documented endpoints.",
    mobileDescription: "Connect ERP, HRIS or payment gateways.",
  },
  {
    icon: "headset",
    title: "Local support 24/7",
    description: "Engineers in Jakarta, Surabaya and Medan with on-site SLA.",
    mobileDescription: "Engineers in Jakarta, Surabaya and Medan.",
  },
];
