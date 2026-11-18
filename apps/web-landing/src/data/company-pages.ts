import type { IconName } from "../lib/icons";
import { images } from "../lib/images";

/** SAMPLE CONTENT for Careers and News & Insights (footer destinations without frames). Replace with CMS data. */

export const openRoles = [
  { title: "Field Installation Engineer", team: "Engineering & Technical Support", location: "Jakarta / Bekasi", type: "Full-time" },
  { title: "Senior Backend Engineer (Node.js)", team: "Software Development", location: "Jakarta · Hybrid", type: "Full-time" },
  { title: "Mobile Engineer (React Native)", team: "Software Development", location: "Jakarta · Hybrid", type: "Full-time" },
  { title: "Technical Support Specialist", team: "Engineering & Technical Support", location: "Surabaya", type: "Full-time" },
  { title: "Key Account Manager — Government", team: "Sales & Customer Relations", location: "Jakarta", type: "Full-time" },
  { title: "Warehouse & Logistics Coordinator", team: "Operations", location: "Bekasi", type: "Full-time" },
];

export const careerPerks: { icon: IconName; title: string; description: string }[] = [
  { icon: "rocket", title: "Build real things", description: "Ship hardware and software that thousands of people walk through every day." },
  { icon: "graduation-cap", title: "Learn on the job", description: "Certification programs, mentoring and a yearly training budget." },
  { icon: "heart-handshake", title: "Look after you", description: "BPJS, private health insurance and performance bonuses." },
  { icon: "map-pin", title: "Work across Indonesia", description: "Teams in Jakarta, Surabaya, Medan and Makassar." },
];

export type NewsArticle = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  date: string; // ISO
  minutes: number;
  image: string;
  body: string[];
};

export const newsArticles: NewsArticle[] = [
  {
    slug: "eg-face-pro-2-launch",
    category: "Product",
    title: "EG-Face Pro 2: contactless access in 0.2 seconds",
    excerpt: "Our new face terminal pairs dual-camera liveness detection with mask and helmet support for busy lobbies.",
    date: "2026-10-14",
    minutes: 4,
    image: images.faceTerminal,
    body: [
      "EG-Face Pro 2 verifies identities in 0.2 seconds with dual-camera liveness detection that rejects photos and screens.",
      "The terminal stores 50,000 faces on device, works with masks and safety helmets, and mounts on every Entragate gate or as a standalone wall reader.",
      "Pre-orders are open now, with first deliveries scheduled for the third week of November.",
    ],
  },
  {
    slug: "cashless-parking-guide",
    category: "Insights",
    title: "Going cashless in your car park without closing a level",
    excerpt: "Lessons from migrating 1,200 bays to ANPR entry and QRIS exit at Grand Indonesia Tower B.",
    date: "2026-09-30",
    minutes: 6,
    image: images.parkingEntrance,
    body: [
      "Cashless parking cuts exit queues and removes cash handling, but many operators worry about the disruption of switching over.",
      "At Grand Indonesia Tower B we migrated one lane at a time, running ANPR in parallel with existing ticket dispensers until every lane was live — the basement never closed.",
      "Exit queue times fell by 62%, and revenue now reconciles automatically each night.",
    ],
  },
  {
    slug: "tkdn-certification",
    category: "Company",
    title: "Entragate barrier gates are now TKDN certified",
    excerpt: "Locally assembled gates qualify for government and BUMN procurement under local-content rules.",
    date: "2026-09-12",
    minutes: 3,
    image: images.engineeringTeam,
    body: [
      "Swing, flap and tripod gates assembled at our Bekasi workshop are now registered under Indonesia's TKDN local-content program.",
      "Government agencies and state-owned enterprises can now procure Entragate gates through e-Katalog with local-content credit.",
    ],
  },
  {
    slug: "visitor-management-checklist",
    category: "Insights",
    title: "A visitor management checklist for office towers",
    excerpt: "Eight things to decide before you replace the lobby logbook.",
    date: "2026-08-21",
    minutes: 5,
    image: images.officeReception,
    body: [
      "Start with who visits: contractors, guests, couriers and interview candidates all need different flows.",
      "Decide whether hosts must pre-register guests, how IDs are verified, which floors passes open and how long data is kept.",
      "Finally, plan for peaks — self-service kiosks and QR passes keep the lobby moving at 8:00.",
    ],
  },
];
