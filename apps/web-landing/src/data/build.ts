import { images } from "../lib/images";

/**
 * SAMPLE CONFIGURATOR PRICING for 03.01 Build Your Solution. Prices reproduce the approved
 * frame (Rp 305.568.800 for the default office-tower setup) and are budget estimates only —
 * the formal quotation from the ERP is authoritative. `product` links each option to the
 * catalog so the configuration can be carried into the RFQ.
 */

export type LaneKind = "pedestrian" | "vehicle";

export type GateOption = {
  id: string;
  kind: LaneKind;
  name: string;
  summaryName?: string;
  detail: string;
  price: number; // per lane
  image: string;
  product?: string;
  recommended?: boolean;
};

export const gateOptions: GateOption[] = [
  { id: "swing-s200", kind: "pedestrian", name: "EG-Swing S200 Glass", detail: "Premium · 900 mm lane", price: 38_500_000, image: images.swingBarrierDouble, product: "eg-swing-s200-glass", recommended: true },
  { id: "flap-f150", kind: "pedestrian", name: "EG-Flap F150 Slim", detail: "High throughput · 600 mm", price: 29_900_000, image: images.flapBarrier, product: "eg-flap-f150-slim" },
  { id: "tripod-t100", kind: "pedestrian", name: "EG-Tripod T100", detail: "Budget · robust", price: 14_750_000, image: images.tripodTurnstile, product: "eg-tri-t100" },
  { id: "park-bg500", kind: "vehicle", name: "EG-Park BG-500", detail: "6 m arm · 1.5 s open", price: 33_000_000, image: images.parkingBarrier, product: "eg-park-b6-boom", recommended: true },
  { id: "ticket-anpr", kind: "vehicle", name: "Ticket & ANPR kit", detail: "Dispenser + LPR camera", price: 46_200_000, image: images.parkingKiosk, product: "eg-kiosk-k2-ticket-dispenser" },
  { id: "controller-ac4", kind: "vehicle", name: "Access Controller AC-4", detail: "RFID / QR lane control", price: 12_400_000, image: images.accessController, product: "eg-core-c4-controller" },
];

export const laneKinds: Record<LaneKind, { label: string; icon: "door-open" | "car" }> = {
  pedestrian: { label: "Pedestrian lanes", icon: "door-open" },
  vehicle: { label: "Vehicle lanes", icon: "car" },
};

export type AddOn = {
  id: string;
  name: string;
  summaryName: string;
  icon: "scan-face" | "qr-code" | "user-check" | "shield-check";
  /** Price per pedestrian + vehicle lane, per unit, or as a share of hardware. */
  pricing: { per: "lane"; price: number } | { per: "unit"; price: number } | { per: "hardware"; rate: number };
  product?: string;
  default?: boolean;
};

export const addOns: AddOn[] = [
  { id: "face", name: "Face recognition readers", summaryName: "Face recognition reader FR-8", icon: "scan-face", pricing: { per: "lane", price: 8_100_000 }, product: "eg-face-pro-2", default: true },
  { id: "qr", name: "QR / RFID readers", summaryName: "QR / RFID reader RQ-1", icon: "qr-code", pricing: { per: "lane", price: 1_590_000 }, product: "eg-scan-q3", default: true },
  { id: "kiosk", name: "Visitor self-service kiosk", summaryName: "Visitor self-service kiosk", icon: "user-check", pricing: { per: "unit", price: 18_500_000 } },
  { id: "warranty", name: "5-year extended warranty", summaryName: "5-year extended warranty", icon: "shield-check", pricing: { per: "hardware", rate: 0.06 } },
];

export type SoftwareOption = { id: string; name: string; description: string; monthly: number; solution: string; default?: boolean };

export const softwareOptions: SoftwareOption[] = [
  { id: "access-cloud", name: "Entragate Access Cloud", description: "Credentials, schedules and audit trails for every lane.", monthly: 1_500_000, solution: "access-control", default: true },
  { id: "visitor", name: "Visitor Management", description: "Pre-registration, kiosks and QR passes.", monthly: 1_250_000, solution: "visitor-management" },
  { id: "parking", name: "Smart Parking", description: "LPR entry, occupancy and cashless exit.", monthly: 2_000_000, solution: "smart-parking" },
  { id: "gym", name: "Gym Management", description: "Memberships, bookings and billing.", monthly: 1_750_000, solution: "gym-management" },
  { id: "tickets", name: "E-Ticketing", description: "Online sales and gate validation.", monthly: 2_250_000, solution: "e-ticketing" },
  { id: "library", name: "Library Management", description: "RFID loans and member gates.", monthly: 1_250_000, solution: "library-management" },
];

export const subscriptionTerms = [12, 24, 36];

export const siteTypes = [
  { id: "office", label: "Office tower", icon: "building-2" },
  { id: "mall", label: "Mall & parking", icon: "square-parking" },
  { id: "campus", label: "Campus & library", icon: "graduation-cap" },
  { id: "gym", label: "Gym & club", icon: "dumbbell" },
  { id: "venue", label: "Stadium & venue", icon: "ticket" },
  { id: "government", label: "Government", icon: "landmark" },
] as const;

export const pricingRules = {
  installationPerLane: 6_000_000,
  /** Estimated project discount once the configuration passes the threshold. */
  discountRate: 0.08,
  discountThreshold: 150_000_000,
};

export type BuildConfig = {
  siteType: string;
  siteName: string;
  city: string;
  dailyVisitors: number;
  entries: { id: string; name: string; kind: LaneKind; lanes: number; option: string }[];
  addOns: string[];
  kiosks: number;
  software: string[];
  term: number;
};

export const defaultConfig: BuildConfig = {
  siteType: "office",
  siteName: "Office tower",
  city: "Jakarta Selatan",
  dailyVisitors: 2400,
  entries: [
    { id: "main-lobby", name: "Main lobby", kind: "pedestrian", lanes: 4, option: "swing-s200" },
    { id: "basement-parking", name: "Basement parking", kind: "vehicle", lanes: 2, option: "park-bg500" },
  ],
  addOns: addOns.filter((a) => a.default).map((a) => a.id),
  kiosks: 1,
  software: softwareOptions.filter((s) => s.default).map((s) => s.id),
  term: 12,
};

export type BuildLine = { label: string; qty: string; amount: number; product?: string; quantity?: number };
export type BuildEstimate = { lines: BuildLine[]; installation: number; discount: number; total: number; laneCount: number };

/** Budget estimate shared by the configurator UI (and reproducible on the server). */
export function estimate(config: BuildConfig): BuildEstimate {
  const lines: BuildLine[] = [];
  const laneCount = config.entries.reduce((n, e) => n + e.lanes, 0);
  let hardware = 0;
  // Group lanes by gate option so the summary reads "EG-Swing S200 Glass × 4".
  const byOption = new Map<string, number>();
  for (const entry of config.entries) byOption.set(entry.option, (byOption.get(entry.option) ?? 0) + entry.lanes);
  for (const [id, lanes] of byOption) {
    const option = gateOptions.find((o) => o.id === id);
    if (!option || lanes === 0) continue;
    const amount = option.price * lanes;
    hardware += amount;
    lines.push({ label: option.summaryName ?? option.name, qty: `× ${lanes}`, amount, product: option.product, quantity: lanes });
  }
  for (const id of config.addOns) {
    const addOn = addOns.find((a) => a.id === id);
    if (!addOn) continue;
    if (addOn.pricing.per === "lane" && laneCount > 0) {
      const amount = addOn.pricing.price * laneCount;
      hardware += amount;
      lines.push({ label: addOn.summaryName, qty: `× ${laneCount}`, amount, product: addOn.product, quantity: laneCount });
    } else if (addOn.pricing.per === "unit" && config.kiosks > 0) {
      const amount = addOn.pricing.price * config.kiosks;
      hardware += amount;
      lines.push({ label: addOn.summaryName, qty: `× ${config.kiosks}`, amount });
    }
  }
  const warranty = addOns.find((a) => a.id === "warranty");
  if (warranty && config.addOns.includes("warranty") && warranty.pricing.per === "hardware") {
    lines.push({ label: warranty.summaryName, qty: "5 yr", amount: Math.round(hardware * warranty.pricing.rate) });
  }
  for (const id of config.software) {
    const software = softwareOptions.find((s) => s.id === id);
    if (software) lines.push({ label: software.name, qty: `${config.term} mo`, amount: software.monthly * config.term });
  }
  const installation = laneCount * pricingRules.installationPerLane;
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0) + installation;
  const discount = subtotal >= pricingRules.discountThreshold ? Math.round(subtotal * pricingRules.discountRate) : 0;
  return { lines, installation, discount, total: subtotal - discount, laneCount };
}
