import type { ProductDetail, ProductFeature, ProductOption, ProductSpec, ProductSummary } from "../types/catalog";
import { images } from "../lib/images";

/**
 * SAMPLE CONTENT: product-page copy per category, used for every product without a
 * hand-written entry in `data/catalog.ts`. Replace with ERP product data (specs,
 * datasheets, media) when the catalog endpoint is available.
 */

type CategoryTemplate = {
  gallery: string[];
  overviewTitle: string;
  overview: string;
  features: ProductFeature[];
  specs: ProductSpec[];
  options: ProductOption[];
  band: NonNullable<ProductDetail["band"]>;
  priceUnit: string;
};

const finish: ProductOption = {
  name: "Finish",
  defaultValue: "brushed-sus304",
  choices: [
    { value: "brushed-sus304", label: "Brushed SUS304", mobileLabel: "Brushed" },
    { value: "black-titanium", label: "Black Titanium", mobileLabel: "Black Ti" },
  ],
};

const reader: ProductOption = {
  name: "Reader module",
  defaultValue: "rfid",
  choices: [
    { value: "rfid", label: "RFID 13.56 MHz", mobileLabel: "RFID" },
    { value: "qr", label: "QR + RFID", mobileLabel: "QR + RFID" },
    { value: "face", label: "EG-Face module", mobileLabel: "Face" },
  ],
};

const lobbyBand = (title: string, stats: [string, string][]): CategoryTemplate["band"] => ({
  image: images.officeLobby,
  eyebrow: "Built to last",
  title,
  stats: stats.map(([value, label]) => ({ value, label })),
});

const templates: Record<string, CategoryTemplate> = {
  "swing-barrier-gate": {
    gallery: [images.swingGateGlass, images.swingGateHinge, images.flapBarrierReader, images.corporateLobby],
    overviewTitle: "Wide, accessible lanes with an architectural finish.",
    overview:
      "Series S swing gates combine tempered-glass wings with a brushless servo drive and infrared safety arrays. Wide lanes serve wheelchairs, trolleys and luggage while keeping tailgating out — ideal for hospitals, hotels and premium offices.",
    features: [
      { icon: "zap", title: "Fast, silent drive", description: "Brushless DC servo with soft-start and soft-stop.", mobileTitle: "Silent drive", mobileDescription: "Brushless servo" },
      { icon: "shield-check", title: "Anti-tailgating", description: "Infrared arrays detect intrusion and reverse passage.", mobileTitle: "Anti-tailgating", mobileDescription: "IR beam arrays" },
      { icon: "flame", title: "Fire alarm link", description: "Wings open automatically on alarm or power loss.", mobileTitle: "Fire alarm link", mobileDescription: "Auto-open" },
      { icon: "plug-zap", title: "Modular reader bay", description: "RFID, QR, fingerprint or face modules.", mobileTitle: "Modular readers", mobileDescription: "RFID, QR, Face" },
    ],
    specs: [
      { label: "Housing", value: "SUS304 brushed stainless, 1.5 mm", mobileValue: "SUS304, 1.5 mm", mobile: true },
      { label: "Wing material", value: "12 mm tempered glass", mobileLabel: "Wing", mobile: true },
      { label: "Lane width", value: "900 / 1100 mm (ADA)", mobile: true },
      { label: "Drive", value: "Brushless DC servo, 24V", mobile: true },
      { label: "Throughput", value: "30–35 persons / min", mobile: true },
      { label: "MCBF", value: "3,000,000 cycles", mobile: true },
      { label: "Protection", value: "IP54, indoor / sheltered", mobileValue: "IP54", mobile: true },
      { label: "Interfaces", value: "Wiegand 26/34, RS485, TCP/IP", mobileValue: "Wiegand, RS485, TCP/IP", mobile: true },
      { label: "Power", value: "AC 220V ±10%, 50 Hz" },
    ],
    options: [
      { name: "Lane width", defaultValue: "1100", choices: [{ value: "900", label: "900 mm" }, { value: "1100", label: "1100 mm (ADA)", mobileLabel: "1100 mm" }] },
      finish,
    ],
    band: lobbyBand("Engineered for 3 million cycles of silent, reliable access.", [["0.8s", "Wing opening time"], ["35/min", "Throughput per lane"], ["3M", "Mean cycles between failures"], ["IP54", "Dust & splash protection"]]),
    priceUnit: "/ lane · excl. PPN 11%",
  },
  "flap-barrier-gate": {
    gallery: [images.flapBarrier, images.flapBarrierDisplay, images.flapBarrierReader, images.campusLobby],
    overviewTitle: "High-throughput lanes for busy entrances.",
    overview:
      "Entragate flap barriers retract acrylic wings in 0.3 seconds for up to 45 passages per minute. LED direction indicators guide visitors, and the reader bay supports RFID, QR and face recognition for offices, campuses and transit hubs.",
    features: [
      { icon: "zap", title: "0.3s wing retraction", description: "Brushless motor sized for peak-hour queues.", mobileTitle: "0.3s retraction", mobileDescription: "Peak-hour ready" },
      { icon: "eye", title: "LED guidance", description: "Directional arrows and status lights on both ends.", mobileTitle: "LED guidance", mobileDescription: "Arrows & status" },
      { icon: "shield-check", title: "Anti-pinch safety", description: "Infrared beams and clutch protect every user.", mobileTitle: "Anti-pinch", mobileDescription: "IR + clutch" },
      { icon: "plug-zap", title: "Open integration", description: "Wiegand, RS485 and TCP/IP with dry-contact I/O.", mobileTitle: "Open I/O", mobileDescription: "Wiegand, TCP/IP" },
    ],
    specs: [
      { label: "Housing", value: "SUS304 stainless, 1.2 mm", mobile: true },
      { label: "Wing material", value: "Acrylic, 10 mm", mobileLabel: "Wing", mobile: true },
      { label: "Lane width", value: "550 / 650 mm", mobile: true },
      { label: "Opening time", value: "0.3 s", mobile: true },
      { label: "Throughput", value: "40–45 persons / min", mobile: true },
      { label: "MCBF", value: "5,000,000 cycles", mobile: true },
      { label: "Protection", value: "IP54", mobile: true },
      { label: "Interfaces", value: "Wiegand 26/34, RS485, TCP/IP", mobileValue: "Wiegand, RS485, TCP/IP" },
      { label: "Power", value: "AC 220V ±10%, 50 Hz" },
    ],
    options: [reader, finish],
    band: lobbyBand("Rated for 5 million cycles at peak-hour throughput.", [["0.3s", "Wing retraction"], ["45/min", "Throughput per lane"], ["5M", "Mean cycles between failures"], ["IP54", "Dust & splash protection"]]),
    priceUnit: "/ lane · excl. PPN 11%",
  },
  "tripod-turnstile": {
    gallery: [images.tripodTurnstile, images.transitTurnstiles, images.stadiumEntrance],
    overviewTitle: "Rugged single-file control for gyms, stadiums and transit.",
    overview:
      "Tripod turnstiles deliver dependable one-person-per-credential entry at an accessible price. Stainless housings, mechanical anti-backup and drop-arm emergency release make them the workhorse for stadiums, campuses and fitness clubs.",
    features: [
      { icon: "shield-check", title: "Anti-backup lock", description: "Mechanical damper prevents reverse rotation.", mobileTitle: "Anti-backup", mobileDescription: "Mechanical lock" },
      { icon: "flame", title: "Drop-arm release", description: "Arm drops for free egress on alarm or power loss.", mobileTitle: "Drop-arm", mobileDescription: "Emergency egress" },
      { icon: "cloud", title: "Weather resistant", description: "Sealed electronics rated for sheltered outdoor use.", mobileTitle: "Outdoor ready", mobileDescription: "Sealed electronics" },
      { icon: "plug-zap", title: "Reader ready", description: "Pre-cut for RFID, QR or face terminals.", mobileTitle: "Reader ready", mobileDescription: "RFID, QR, Face" },
    ],
    specs: [
      { label: "Housing", value: "SUS304 stainless, 1.2 mm", mobile: true },
      { label: "Arms", value: "Ø38 mm stainless tubes", mobile: true },
      { label: "Throughput", value: "25–30 persons / min", mobile: true },
      { label: "Rotation", value: "Bi-directional, programmable", mobile: true },
      { label: "MCBF", value: "5,000,000 cycles", mobile: true },
      { label: "Protection", value: "IP54 (T100) / IP65 (T300)", mobileValue: "IP54 / IP65", mobile: true },
      { label: "Interfaces", value: "Dry contact, RS485, TCP/IP" },
      { label: "Power", value: "AC 220V ±10%, 50 Hz" },
    ],
    options: [reader],
    band: lobbyBand("Built for stadium-scale crowds, season after season.", [["30/min", "Throughput per lane"], ["5M", "Mean cycles between failures"], ["IP65", "Outdoor model rating"], ["2 yr", "On-site warranty"]]),
    priceUnit: "/ unit · excl. PPN 11%",
  },
  "face-recognition": {
    gallery: [images.faceTerminal, images.officeReception, images.corporateLobby],
    overviewTitle: "Touchless identity at every door.",
    overview:
      "Entragate face terminals verify identities in under 0.3 seconds with liveness detection against photos and screens. They work standalone or as the reader for any Entragate gate, and sync templates through the Entragate cloud.",
    features: [
      { icon: "scan-face", title: "0.3s recognition", description: "Dual-camera liveness detection.", mobileTitle: "0.3s match", mobileDescription: "Liveness check" },
      { icon: "users", title: "Large face library", description: "Store tens of thousands of templates on device.", mobileTitle: "Large library", mobileDescription: "On-device" },
      { icon: "cloud", title: "Cloud sync", description: "Enrol once, deploy to every site.", mobileTitle: "Cloud sync", mobileDescription: "Enrol once" },
      { icon: "nfc", title: "Multi-credential", description: "Face, RFID card, QR and PIN in one terminal.", mobileTitle: "Multi-credential", mobileDescription: "Face, card, QR" },
    ],
    specs: [
      { label: "Display", value: "IPS touch screen", mobile: true },
      { label: "Camera", value: "2 MP dual-lens, WDR", mobile: true },
      { label: "Recognition", value: "< 0.3 s, liveness detection", mobile: true },
      { label: "Distance", value: "0.3 – 2.0 m", mobile: true },
      { label: "Credentials", value: "Face, RFID, QR, PIN", mobile: true },
      { label: "Interfaces", value: "Wiegand in/out, RS485, TCP/IP, PoE", mobileValue: "Wiegand, TCP/IP, PoE", mobile: true },
      { label: "Protection", value: "IP65, IK06" },
      { label: "Power", value: "12V DC / PoE" },
    ],
    options: [{ name: "Mount", defaultValue: "wall", choices: [{ value: "wall", label: "Wall mount" }, { value: "gate", label: "Gate bracket" }, { value: "pedestal", label: "Pedestal" }] }],
    band: lobbyBand("Recognises a face in under 0.3 seconds — even at peak hour.", [["0.3s", "Recognition speed"], ["99.7%", "Verification accuracy"], ["IP65", "Weather sealed"], ["PoE", "Single-cable install"]]),
    priceUnit: "/ unit · excl. PPN 11%",
  },
  "parking-barrier": {
    gallery: [images.parkingBarrier, images.parkingEntrance, images.smartParkingMall],
    overviewTitle: "Reliable boom barriers for every parking lane.",
    overview:
      "Entragate parking barriers pair a brushless drive with loop-detector safety and auto-reverse on obstruction. Combine them with LPR cameras, ticket kiosks and Smart Parking software for ticketless, cashless facilities.",
    features: [
      { icon: "zap", title: "Fast opening", description: "Brushless DC drive with soft landing.", mobileTitle: "Fast opening", mobileDescription: "Brushless drive" },
      { icon: "shield-check", title: "Auto-reverse safety", description: "Loop detector and infrared photocell input.", mobileTitle: "Auto-reverse", mobileDescription: "Loop + photocell" },
      { icon: "car", title: "LPR ready", description: "Pairs with Entragate plate-recognition cameras.", mobileTitle: "LPR ready", mobileDescription: "Plate recognition" },
      { icon: "plug-zap", title: "Manual release", description: "Hand crank and battery backup options.", mobileTitle: "Manual release", mobileDescription: "Crank + battery" },
    ],
    specs: [
      { label: "Boom length", value: "Up to 6 m (B6) / 4 m (B4)", mobileValue: "Up to 6 m", mobile: true },
      { label: "Opening time", value: "0.9 – 1.5 s", mobile: true },
      { label: "Drive", value: "Brushless DC, 24V", mobile: true },
      { label: "MCBF", value: "5,000,000 cycles", mobile: true },
      { label: "Protection", value: "IP54", mobile: true },
      { label: "Safety inputs", value: "Loop detector, photocell", mobile: true },
      { label: "Interfaces", value: "Dry contact, RS485, TCP/IP" },
      { label: "Power", value: "AC 220V ±10%, 50 Hz" },
    ],
    options: [{ name: "Boom", defaultValue: "straight", choices: [{ value: "straight", label: "Straight arm" }, { value: "folding", label: "Folding arm" }, { value: "fence", label: "Fence arm" }] }],
    band: { image: images.parkingEntrance, eyebrow: "Built to last", title: "Millions of cycles at the busiest parking entrances.", stats: [{ value: "0.9s", label: "Fastest opening" }, { value: "5M", label: "Mean cycles between failures" }, { value: "6m", label: "Maximum boom" }, { value: "IP54", label: "Outdoor rated" }] },
    priceUnit: "/ unit · excl. PPN 11%",
  },
  "parking-equipment": {
    gallery: [images.parkingKiosk, images.smartParkingMall, images.parkingEntrance],
    overviewTitle: "Complete entry and exit flows for modern parking.",
    overview:
      "Ticket dispensers and payment kiosks issue QR tickets, read e-money and QRIS, and talk to Entragate Smart Parking in real time — so revenue, occupancy and gate events are reconciled automatically.",
    features: [
      { icon: "qr-code", title: "QR tickets", description: "Thermal printer with paper-low alerts.", mobileTitle: "QR tickets", mobileDescription: "Thermal printer" },
      { icon: "receipt", title: "Cashless payment", description: "QRIS, e-money and bank cards.", mobileTitle: "Cashless", mobileDescription: "QRIS & cards" },
      { icon: "headset", title: "Intercom", description: "Two-way call to the control room.", mobileTitle: "Intercom", mobileDescription: "Call operator" },
      { icon: "cloud", title: "Live sync", description: "Every transaction reaches Smart Parking instantly.", mobileTitle: "Live sync", mobileDescription: "Real-time" },
    ],
    specs: [
      { label: "Cabinet", value: "Powder-coated steel, anti-vandal", mobile: true },
      { label: "Payments", value: "QRIS, e-money, debit/credit", mobile: true },
      { label: "Printer", value: "80 mm thermal, auto-cut", mobile: true },
      { label: "Display", value: '10" touch screen', mobile: true },
      { label: "Protection", value: "IP54", mobile: true },
      { label: "Interfaces", value: "TCP/IP, RS485, dry contact" },
      { label: "Power", value: "AC 220V ±10%, 50 Hz" },
    ],
    options: [],
    band: { image: images.smartParkingMall, eyebrow: "Built to last", title: "Ticketless, cashless parking that reconciles itself.", stats: [{ value: "3s", label: "Average exit time" }, { value: "24/7", label: "Unattended operation" }, { value: "QRIS", label: "Cashless ready" }, { value: "IP54", label: "Outdoor rated" }] },
    priceUnit: "/ unit · excl. PPN 11%",
  },
  "rfid-qr-scanner": {
    gallery: [images.accessTerminal, images.rfidKit, images.officeReception],
    overviewTitle: "Fast, reliable credential reading.",
    overview:
      "Compact readers for cards, fobs, phones and QR codes. Mount them on walls, gates or kiosks and connect over Wiegand, RS485 or TCP/IP to any Entragate controller.",
    features: [
      { icon: "nfc", title: "Multi-format", description: "Mifare, DESFire, NFC phones and QR.", mobileTitle: "Multi-format", mobileDescription: "Cards, NFC, QR" },
      { icon: "zap", title: "Instant reads", description: "Under 100 ms read time.", mobileTitle: "Instant", mobileDescription: "< 100 ms" },
      { icon: "cloud", title: "Weatherproof", description: "IP65 housing for outdoor use.", mobileTitle: "IP65", mobileDescription: "Outdoor" },
      { icon: "plug-zap", title: "Standard wiring", description: "Wiegand 26/34 and RS485 out of the box.", mobileTitle: "Standard wiring", mobileDescription: "Wiegand, RS485" },
    ],
    specs: [
      { label: "Frequency", value: "13.56 MHz", mobile: true },
      { label: "Cards", value: "Mifare Classic, DESFire EV2, NFC", mobileValue: "Mifare, DESFire, NFC", mobile: true },
      { label: "QR", value: "Screen and paper codes", mobile: true },
      { label: "Read time", value: "< 100 ms", mobile: true },
      { label: "Protection", value: "IP65", mobile: true },
      { label: "Interfaces", value: "Wiegand 26/34, RS485", mobile: true },
      { label: "Power", value: "12V DC" },
    ],
    options: [],
    band: lobbyBand("Reads in under 100 milliseconds, rain or shine.", [["100ms", "Read time"], ["IP65", "Outdoor rated"], ["3", "Credential types"], ["2 yr", "Warranty"]]),
    priceUnit: "/ unit · excl. PPN 11%",
  },
  "access-controllers": {
    gallery: [images.accessController, images.engineeringTeam],
    overviewTitle: "The brain behind every door and gate.",
    overview:
      "Networked controllers manage readers, locks and gates with offline decision-making, so doors keep working even when the network doesn't. Manage them from Entragate Access Control software or the REST API.",
    features: [
      { icon: "cpu", title: "Offline decisions", description: "Stores credentials and events locally.", mobileTitle: "Works offline", mobileDescription: "Local storage" },
      { icon: "server", title: "Networked", description: "TCP/IP with optional PoE.", mobileTitle: "Networked", mobileDescription: "TCP/IP, PoE" },
      { icon: "code", title: "Open API", description: "REST API and SDK for integrations.", mobileTitle: "Open API", mobileDescription: "REST + SDK" },
      { icon: "flame", title: "Fire release", description: "Fail-safe input unlocks all doors.", mobileTitle: "Fire release", mobileDescription: "Fail-safe" },
    ],
    specs: [
      { label: "Doors", value: "2 or 4 doors / readers", mobile: true },
      { label: "Users", value: "100,000 credentials", mobile: true },
      { label: "Events", value: "200,000 offline events", mobile: true },
      { label: "Interfaces", value: "TCP/IP, RS485, Wiegand", mobile: true },
      { label: "Power", value: "12V DC / PoE (C2)", mobile: true },
      { label: "Enclosure", value: "Steel cabinet with tamper switch" },
    ],
    options: [],
    band: lobbyBand("Keeps every door working, even offline.", [["100k", "Credentials"], ["200k", "Offline events"], ["4", "Doors per unit"], ["PoE", "Single cable"]]),
    priceUnit: "/ unit · excl. PPN 11%",
  },
  accessories: {
    gallery: [images.rfidKit, images.accessController],
    overviewTitle: "Everything you need to finish the install.",
    overview:
      "Cards, fobs, locks, exit buttons and power supplies tested with Entragate gates and controllers — ordered together so installs finish on the first visit.",
    features: [
      { icon: "badge-check", title: "Tested together", description: "Validated with Entragate hardware.", mobileTitle: "Tested", mobileDescription: "With Entragate" },
      { icon: "truck", title: "Ready stock", description: "Ships next working day from Jakarta.", mobileTitle: "Ready stock", mobileDescription: "Next-day" },
      { icon: "key-round", title: "Secure credentials", description: "Encrypted sectors on supported cards.", mobileTitle: "Secure", mobileDescription: "Encrypted" },
      { icon: "wrench", title: "Install friendly", description: "Clear labels and mounting hardware included.", mobileTitle: "Easy install", mobileDescription: "Hardware included" },
    ],
    specs: [
      { label: "Compatibility", value: "All Entragate readers & controllers", mobileValue: "All Entragate hardware", mobile: true },
      { label: "Warranty", value: "1 year", mobile: true },
      { label: "Lead time", value: "Ready stock", mobile: true },
    ],
    options: [],
    band: lobbyBand("Accessories tested with every Entragate gate.", [["1 day", "Dispatch"], ["100%", "Compatibility tested"], ["1 yr", "Warranty"], ["40+", "Accessories"]]),
    priceUnit: "· excl. PPN 11%",
  },
};

/** Builds a full product page from the category template (sample content). */
export function templateDetail(product: ProductSummary, stockLabel: string, related: string[]): ProductDetail | undefined {
  const t = templates[product.categorySlug];
  if (!t) return undefined;
  const model = product.specs.split("·")[0]?.trim() ?? product.name;
  return {
    slug: product.slug,
    shortName: model.split("-").pop(),
    eyebrow: product.category,
    model,
    reviewCount: Math.round(product.rating * 9),
    summary: `${t.overviewTitle} ${product.specs}.`,
    stockLabel,
    priceUnit: product.price === null ? "· project pricing" : t.priceUnit,
    mobilePriceUnit: product.price === null ? "" : t.priceUnit.split("·")[0].trim(),
    priceNote:
      product.price === null
        ? "Pricing depends on site survey — request a project quotation"
        : "Volume pricing available with a project quotation",
    mobilePriceNote: product.price === null ? "Project pricing after site survey" : "Excl. PPN 11% · Volume pricing available",
    options: t.options,
    gallery: product.image ? [product.image, ...t.gallery.filter((src) => src !== product.image)].slice(0, 4) : t.gallery,
    overviewTitle: t.overviewTitle,
    overview: t.overview,
    mobileOverview: t.overview,
    features: t.features,
    specs: [{ label: "Model", value: model, mobile: true }, ...t.specs],
    band: t.band,
    related,
  };
}
