/**
 * SAMPLE comparison attributes for 02.03 Product Comparison. Values for the three products
 * in the frame are transcribed from it; others derive from their category. Replace with
 * ERP specification records.
 */

export type CompareValue = string | boolean | null;

export type CompareRow = { key: string; label: string; mobileLabel?: string; mobile?: boolean };
export type CompareGroup = { title: string; mobileTitle?: string; rows: CompareRow[] };

export const compareGroups: CompareGroup[] = [
  {
    title: "Performance",
    rows: [
      { key: "opening", label: "Opening time", mobile: true },
      { key: "throughput", label: "Throughput", mobile: true },
      { key: "mcbf", label: "MCBF", mobile: true },
    ],
  },
  {
    title: "Build",
    rows: [
      { key: "housing", label: "Housing" },
      { key: "barrier", label: "Barrier", mobile: true },
      { key: "lane", label: "Lane width", mobile: true },
      { key: "protection", label: "Protection", mobile: true },
    ],
  },
  {
    title: "Access & integration",
    mobileTitle: "Access",
    rows: [
      { key: "readers", label: "Readers supported", mobileLabel: "Readers", mobile: true },
      { key: "interfaces", label: "Interfaces" },
      { key: "fire", label: "Fire alarm input" },
      { key: "ada", label: "Accessible (ADA) lane", mobileLabel: "ADA lane", mobile: true },
    ],
  },
  {
    title: "Service",
    rows: [
      { key: "warranty", label: "Warranty" },
      { key: "installation", label: "Installation" },
    ],
  },
];

type Values = Record<string, CompareValue>;

const byCategory: Record<string, Values> = {
  "swing-barrier-gate": { opening: "0.6 s", throughput: "35–40 / min", mcbf: "3,000,000", housing: "SUS304 1.5 mm", barrier: "10 mm tempered glass", lane: "600 / 900 / 1100 mm", protection: "IP54", readers: "RFID, QR, Face, Fingerprint", interfaces: "Wiegand, RS485, TCP/IP", fire: true, ada: true, warranty: "2 yr (ext. 3 yr)", installation: "Included in Jabodetabek" },
  "flap-barrier-gate": { opening: "0.4 s", throughput: "45–50 / min", mcbf: "5,000,000", housing: "SUS304 1.2 mm", barrier: "Acrylic flap wings", lane: "550 / 900 mm", protection: "IP54", readers: "RFID, QR, Face", interfaces: "Wiegand, RS485, TCP/IP", fire: true, ada: false, warranty: "2 yr (ext. 3 yr)", installation: "Included in Jabodetabek" },
  "tripod-turnstile": { opening: "1.0 s", throughput: "25–30 / min", mcbf: "2,000,000", housing: "SUS304 1.2 mm", barrier: "3 rotating arms", lane: "550 mm", protection: "IP44", readers: "RFID, QR", interfaces: "Wiegand, RS485", fire: true, ada: false, warranty: "1 yr (ext. 2 yr)", installation: "Optional" },
  "parking-barrier": { opening: "1.5 s", throughput: "8–10 cars / min", mcbf: "5,000,000", housing: "Powder-coated steel", barrier: "Aluminium boom", lane: "Up to 6 m", protection: "IP54", readers: "LPR, RFID, QR ticket", interfaces: "Dry contact, RS485, TCP/IP", fire: true, ada: null, warranty: "2 yr", installation: "Included in Jabodetabek" },
  "face-recognition": { opening: null, throughput: "< 0.3 s / face", mcbf: null, housing: "Aluminium, IP65", barrier: null, lane: null, protection: "IP65", readers: "Face, RFID, QR, PIN", interfaces: "Wiegand, RS485, TCP/IP, PoE", fire: false, ada: null, warranty: "2 yr", installation: "Optional" },
};

/** Per-product overrides on top of the category defaults. */
const byProduct: Record<string, Values> = {
  "eg-swing-s300-dual": { opening: "0.8 s", throughput: "30–35 / min", lane: "900 / 1100 mm", barrier: "12 mm tempered glass" },
  "eg-flap-f200-wide": { lane: "650 mm", throughput: "40–45 / min" },
  "eg-tri-t300-auto": { protection: "IP65", warranty: "2 yr (ext. 3 yr)", mcbf: "5,000,000" },
  "eg-park-b4-straight": { opening: "0.9 s", lane: "Up to 4 m" },
  "eg-face-lite-1": { throughput: "< 0.5 s / face", readers: "Face, RFID" },
};

/** Attribute values for a product; `null` renders as "—". */
export function compareValues(slug: string, categorySlug: string): Values {
  return { ...(byCategory[categorySlug] ?? {}), ...(byProduct[slug] ?? {}) };
}

/** Short positioning line under the product name in the comparison header. */
export const comparePitch: Record<string, string> = {
  "eg-swing-s200-glass": "Best for premium lobbies",
  "eg-flap-f150-slim": "Best value · high throughput",
  "eg-tri-t100": "Best for warehouses & gyms",
};

export const MAX_COMPARE = 4;
export const defaultCompare = ["eg-swing-s200-glass", "eg-flap-f150-slim", "eg-tri-t100"];
