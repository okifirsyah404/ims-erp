import { type DocumentLibrary, type HomeSummary, type InvoiceSummary, type OrderDetail, type OrderSummary, type PaymentMethod, type PortalNotification, type PortalUser, type ProfileSummary, type ProjectDetail, type ProjectSummary, type QuotationDetail, type QuotationSummary, type RegisteredProduct, type ServiceDay, type ServiceType, type TicketDetail, type TicketSummary, type WarrantyDetail } from "@/api/portal";

/**
 * Demo fixtures copied from the approved mobile frames (05.x, 07.x, 08.x). Used only
 * by the demo data source; never shipped as ERP data.
 */

export const demoUser: PortalUser = {
  id: "usr_hendra",
  name: "Hendra Wijaya",
  initials: "HW",
  email: "hendra@majulogistik.co.id",
  phone: "+62 812 3456 7890",
  jobTitle: "Procurement Manager",
  accountType: "business",
  verified: true,
  company: { id: "cmp_mln", name: "PT Maju Logistik Nusantara", npwp: "01.234.567.8-901.000", shortName: "ML" },
  roles: ["customer"],
};

export const orders: OrderSummary[] = [
  {
    id: "ENT-2026-0418",
    number: "#ENT-2026-0418",
    title: "Barrier Gate BG-500 × 4",
    status: "shipped",
    statusLabel: "Shipped",
    step: 4,
    stepCount: 5,
    stepLabel: "In transit",
    progress: 0.78,
    etaLabel: "ETA 29 Oct",
    total: 148_500_000,
    placedAt: "2026-10-12",
  },
  {
    id: "ENT-2026-0402",
    number: "#ENT-2026-0402",
    title: "Face Recognition Terminal FR-8 × 12",
    status: "production",
    statusLabel: "In production",
    step: 2,
    stepCount: 5,
    stepLabel: "Manufacturing",
    progress: 0.39,
    etaLabel: "ETA 12 Nov",
    total: 96_240_000,
    placedAt: "2026-10-05",
  },
  {
    id: "ENT-2026-0391",
    number: "#ENT-2026-0391",
    title: "Flap Barrier FB-2 × 6 + Install",
    status: "installing",
    statusLabel: "Installing",
    step: 5,
    stepCount: 5,
    stepLabel: "On-site install",
    progress: 0.9,
    etaLabel: "Today",
    total: 212_000_000,
    placedAt: "2026-09-28",
  },
  {
    id: "ENT-2026-0377",
    number: "#ENT-2026-0377",
    title: "RFID / QR Reader RQ-1 × 20",
    status: "delivered",
    statusLabel: "Delivered",
    step: 5,
    stepCount: 5,
    stepLabel: "Completed · 18 Oct",
    progress: 1,
    etaLabel: "Delivered",
    total: 31_800_000,
    placedAt: "2026-09-20",
  },
];

const ent0418Timeline: OrderDetail["timeline"] = [
  { title: "Order confirmed", dateLabel: "12 Oct", state: "done" },
  { title: "Payment verified", dateLabel: "14 Oct", state: "done" },
  { title: "Production & quality check", description: "4 units passed 72-hour burn-in test.", dateLabel: "22 Oct", state: "done" },
  { title: "Shipped from Cikarang warehouse", dateLabel: "27 Oct", state: "done" },
  {
    title: "In transit · JNE Jakarta Hub",
    description: "Sorted at Jakarta hub. Next: out for delivery to Grand Indonesia, Basement P3.",
    dateLabel: "Now",
    state: "current",
  },
  { title: "Delivery & installation", dateLabel: "29 Oct", state: "upcoming" },
  { title: "Handover & warranty activation", dateLabel: "—", state: "upcoming" },
];

export const orderDetails: Record<string, Omit<OrderDetail, keyof OrderSummary>> = {
  "ENT-2026-0418": {
    arrivalLabel: "Arriving Thu, 29 Oct",
    arrivalWindow: "Between 09:00 – 12:00 · Installation same day",
    lines: [
      { name: "Barrier Gate BG-500", detail: "SKU EG-BG500 · 6 m arm", quantity: 4, amount: 132_000_000 },
      { name: "Installation & commissioning", detail: "On-site · 1 day", quantity: 1, amount: 16_500_000 },
    ],
    delivery: {
      site: "Grand Indonesia Tower B",
      address: "Basement P3 · Jl. M.H. Thamrin No.1, Jakarta Pusat",
      courier: "JNE Cargo · Trucking",
      awb: "4410 2290 7781",
      pic: "PIC Andi",
    },
    installation: { label: "Same day", detail: "Team of 3 · approx. 6 hours" },
    payment: {
      subtotal: 148_500_000,
      discountLabel: "Project discount (5%)",
      discount: 7_425_000,
      tax: 15_518_250,
      total: 156_593_250,
      paidLabel: "Paid in full · 14 Oct",
    },
    documents: [
      { id: "doc_inv0412", name: "Invoice INV-2026-0412.pdf", meta: "PDF · 182 KB", kind: "pdf" },
      { id: "doc_dn0418", name: "Delivery Note DN-0418.pdf", meta: "PDF · 96 KB", kind: "pdf" },
      { id: "doc_wc0418", name: "Product Warranty Cards.zip", meta: "ZIP · 1.2 MB", kind: "zip" },
    ],
    timeline: ent0418Timeline,
    courier: { name: "JNE Cargo", vehicle: "B 9142 KXT", distanceLabel: "18 km", updatedLabel: "Live · updated 2 min ago" },
  },
};

export const projects: ProjectSummary[] = [
  {
    id: "PRJ-2026-031",
    code: "PRJ-031",
    name: "Smart Parking System",
    site: "Grand Indonesia Tower B",
    status: "on_track",
    stage: 4,
    stageCount: 6,
    stageLabel: "Installation",
    progress: 0.65,
    nextLabel: "Next: Loop detector testing · 3 Nov",
    completionLabel: "Est. completion 14 Nov",
    team: [
      { initials: "DP", name: "Dimas Pratama" },
      { initials: "RS", name: "Rudi Santoso" },
      { initials: "AG", name: "Agus Gunawan" },
      { initials: "LW", name: "Lina Wijaya" },
    ],
  },
  {
    id: "PRJ-2026-027",
    code: "PRJ-027",
    name: "Campus Access Control",
    site: "Universitas Pelita",
    status: "action_needed",
    stage: 2,
    stageCount: 5,
    stageLabel: "Site survey",
    progress: 0.32,
    nextLabel: "Your approval needed: revised floor layout",
    completionLabel: "Est. completion 20 Dec",
    team: [
      { initials: "DP", name: "Dimas Pratama" },
      { initials: "RS", name: "Rudi Santoso" },
      { initials: "AG", name: "Agus Gunawan" },
      { initials: "LW", name: "Lina Wijaya" },
    ],
  },
];

export const projectDetails: Record<string, Omit<ProjectDetail, keyof ProjectSummary>> = {
  "PRJ-2026-031": {
    daysLeft: 20,
    openTasks: 3,
    milestones: [
      { title: "Site survey & design", description: "Layout approved by building management.", dateLabel: "Done · 2 Sep", state: "done" },
      { title: "Procurement & production", description: "Gates fabricated and factory-tested at Bekasi.", dateLabel: "Done · 20 Sep", state: "done" },
      { title: "Cabling & conduit", dateLabel: "Done · 16 Oct", state: "done" },
      {
        title: "Installation",
        dateLabel: "Est. 10 Nov",
        state: "current",
        tasksDone: 6,
        tasksTotal: 10,
        tasks: [
          { label: "Entry barrier gates mounted", done: true },
          { label: "Ticket dispensers wired", done: true },
          { label: "ANPR cameras calibration", done: false },
        ],
        photos: { label: "Latest site photos · 2h ago", urls: [], total: 10 },
      },
      { title: "Testing & commissioning", dateLabel: "Est. 14 Nov", state: "upcoming" },
      { title: "Training & BAST handover", description: "Operator training and Berita Acara Serah Terima sign-off.", dateLabel: "Est. 21 Nov", state: "upcoming" },
    ],
    documents: [
      { id: "doc_w43", name: "Progress Report W43.pdf", meta: "PDF · 2.4 MB · Today", kind: "pdf" },
      { id: "doc_asb", name: "As-built Drawing Rev.B.dwg", meta: "DWG · 8.1 MB · 16 Oct", kind: "dwg" },
      { id: "doc_bast", name: "BAST — Berita Acara Serah Terima (draft).pdf", meta: "PDF · issued at handover", kind: "pdf" },
    ],
    manager: { name: "Dimas Pratama", role: "Project Manager · CV. Inti Multi Solusi", phone: "+622188992020" },
  },
};

export const quotations: QuotationSummary[] = [
  {
    id: "QT-2026-0912",
    number: "QT-2026-0912",
    title: "Parking Guidance System · Lot P3",
    shortTitle: "Parking Guidance · Lot P3",
    status: "needs_approval",
    total: 318_212_000,
    lineCount: 7,
    preparedBy: "Dimas Pratama",
    expiresInDays: 6,
    meta: "Valid 6 days",
    version: 1,
  },
  {
    id: "QT-2026-0897",
    number: "QT-2026-0897",
    title: "ANPR Camera Upgrade",
    status: "revised",
    total: 86_358_000,
    lineCount: 3,
    preparedBy: "Dimas Pratama",
    expiresInDays: 6,
    meta: "Updated yesterday",
    version: 2,
  },
  {
    id: "QT-2026-0855",
    number: "QT-2026-0855",
    title: "Barrier Gate BG-500 × 4",
    status: "accepted",
    total: 156_593_250,
    lineCount: 2,
    preparedBy: "Dimas Pratama",
    meta: "→ Order #ENT-0418",
    version: 1,
  },
  {
    id: "QT-2026-0810",
    number: "QT-2026-0810",
    title: "Turnstile Lobby Retrofit",
    status: "expired",
    total: 74_900_000,
    lineCount: 4,
    preparedBy: "Dimas Pratama",
    meta: "Expired 2 Oct",
    version: 1,
  },
];

export const quotationDetails: Record<string, Omit<QuotationDetail, keyof QuotationSummary>> = {
  "QT-2026-0912": {
    heading: "Parking Guidance System — Basement Lot P3",
    issuedLabel: "25 Oct",
    validUntilLabel: "31 Oct",
    deliveryLabel: "3–4 wks",
    terms: { warranty: "2 years parts & labor · on-site within Jabodetabek", delivery: "3–4 weeks after down payment", conditions: "Standard B2B terms · CV. Inti Multi Solusi" },
    lines: [
      { name: "Parking guidance sensor PGS-U", detail: "Ultrasonic · per bay", quantity: 120, unitPrice: 1_150_000, amount: 138_000_000 },
      { name: "LED zone display ZD-3", detail: "3-direction · outdoor rated", quantity: 8, unitPrice: 6_400_000, amount: 51_200_000 },
      { name: "Central guidance controller", detail: "Incl. software license", quantity: 1, unitPrice: 42_500_000, amount: 42_500_000 },
      { name: "Installation & cabling", detail: "Lot P3 · 120 bays", quantity: 1, unitPrice: 48_000_000, amount: 48_000_000 },
      { name: "Entry/exit counting loops", detail: "Inductive · per lane", quantity: 4, unitPrice: 3_100_000, amount: 12_400_000 },
      { name: "Guidance management software", detail: "Annual license · 1 site", quantity: 1, unitPrice: 6_300_000, amount: 6_300_000 },
      { name: "Operator training", detail: "On-site · 1 day", quantity: 1, unitPrice: 4_000_000, amount: 4_000_000 },
    ],
    breakdown: [
      { label: "Subtotal (7 items)", amount: 302_400_000 },
      { label: "Volume discount 8%", amount: -24_192_000, tone: "success" },
      { label: "Promo ENTRA-Q4", amount: -2_000_000, tone: "success" },
      { label: "DPP", amount: 276_208_000 },
      { label: "PPN 11%", amount: 30_382_880 },
      { label: "Shipping & handling", amount: 11_621_120 },
    ],
    milestones: [
      { label: "30% · Down payment", note: "Due on approval · VA / transfer", amount: 95_460_000 },
      { label: "60% · On delivery", note: "After goods received on site", amount: 190_930_000 },
      { label: "10% · Handover", note: "After commissioning & training", amount: 31_820_000 },
    ],
    accountManager: { name: "Dimas Pratama", role: "Account Manager", replyLabel: "replies in ~15 min" },
    downPaymentRate: 0.3,
    downPaymentDue: "Within 7 days of approval",
    approvers: [
      { id: "usr_hendra", label: "Hendra Wijaya · Procurement" },
      { id: "usr_rina", label: "Rina Kusuma · Approver" },
    ],
    companyName: "PT Maju Logistik Nusantara",
  },
};

export const invoiceData: { outstanding: number; paidThisYear: number; overdue: number; invoices: InvoiceSummary[] } = {
  outstanding: 190_926_000,
  paidThisYear: 1_240_000_000,
  overdue: 0,
  invoices: [
    { id: "INV-2026-0431", number: "INV-2026-0431", description: "Delivery 60% · ENT-0418", amount: 190_926_000, status: "unpaid", dueLabel: "Due 3 Nov", dueDate: "2026-11-03" },
    { id: "INV-2026-0412", number: "INV-2026-0412", description: "DP 30% · ENT-0418", amount: 92_000_000, status: "paid" },
    { id: "INV-2026-0398", number: "INV-2026-0398", description: "Full · ENT-0377", amount: 31_800_000, status: "paid" },
  ],
};

export const paymentMethods: PaymentMethod[] = [
  { id: "va_bca", kind: "virtual_account", name: "BCA Virtual Account", detail: "Instant verification", savedLabel: "Default · 8808 1234 5678 90" },
  { id: "va_mandiri", kind: "virtual_account", name: "Mandiri Virtual Account", detail: "Instant verification" },
  { id: "qris", kind: "qris", name: "QRIS", detail: "GoPay, OVO, DANA, ShopeePay & banks", savedLabel: "Pay with any e-wallet or bank app" },
  { id: "transfer", kind: "transfer", name: "Manual bank transfer", detail: "Verified in 1×24 hours" },
];


export const tickets: TicketSummary[] = [
  {
    id: "TCK-2241",
    number: "#TCK-2241",
    subject: "Gate arm slow to respond at Lot P3 exit",
    shortSubject: "Gate arm slow to respond",
    status: "awaiting_you",
    priority: "urgent",
    lastMessage: {
      author: "Rina",
      role: "Support",
      initials: "R",
      text: "The barrier arm sensor needs recalibration. Can we visit Thursday?",
      ago: "12m",
      unread: 2,
    },
  },
  {
    id: "TCK-2236",
    number: "#TCK-2236",
    subject: "Annual preventive maintenance — Tower B",
    shortSubject: "Annual maintenance visit",
    status: "in_progress",
    priority: "normal",
    lastMessage: { author: "Agus", role: "Field Service", initials: "A", text: "Technician Agus assigned. Checklist attached.", ago: "1d", unread: 0 },
  },
  {
    id: "TCK-2219",
    number: "#TCK-2219",
    subject: "QR reader firmware update",
    status: "resolved",
    priority: "low",
    resolvedLabel: "Resolved 16 Oct",
    rating: 5,
  },
];

export const ticketDetails: Record<string, Omit<TicketDetail, keyof TicketSummary>> = {
  "TCK-2241": {
    stage: 2,
    createdLabel: "27 Oct, 16:02",
    device: { name: "Barrier Gate BG-500", serial: "SN BG5-0418-02" },
    activity: [
      { title: "Created", dateLabel: "27 Oct", state: "done" },
      { title: "Assigned to Rina", dateLabel: "27 Oct", state: "done" },
      { title: "Diagnosed remotely", dateLabel: "Today", state: "current" },
      { title: "Technician visit", dateLabel: "30 Oct", state: "upcoming" },
      { title: "Resolved", dateLabel: "—", state: "upcoming" },
    ],
    agent: { name: "Rina · Entragate Support", initials: "R", online: true, replyLabel: "Online · usually replies in 10 min" },
    quickReplies: ["Yes, Thursday works", "Another time"],
    messages: [
      { kind: "date", id: "d1", label: "Yesterday" },
      { kind: "photo", id: "m0", from: "customer", time: "16:02", read: true },
      {
        kind: "message",
        id: "m1",
        from: "customer",
        text: "The exit barrier at Lot P3 takes 4–5 seconds to open after scanning. Photo attached.",
        time: "16:02",
        read: true,
      },
      { kind: "event", id: "e1", text: "Assigned to Rina · Support L2", icon: "assign" },
      { kind: "message", id: "m2", from: "agent", author: "Rina", text: "Thanks Hendra! I’ve pulled the controller logs remotely — reviewing now.", time: "16:20" },
      { kind: "date", id: "d2", label: "Today" },
      { kind: "attachment", id: "m3", from: "agent", author: "Rina", fileName: "Diagnostic-TCK2241.pdf", size: "PDF · 340 KB", time: "10:24" },
      {
        kind: "message",
        id: "m4",
        from: "agent",
        author: "Rina",
        text: "The barrier arm sensor needs recalibration. Can our technician visit Thursday 30 Oct, 09:00?",
        time: "10:24",
      },
    ],
  },
};

export const products: RegisteredProduct[] = [
  {
    id: "BG5-0418",
    name: "Barrier Gate BG-500 × 4",
    serialLabel: "SN BG5-0418-01 → 04",
    site: "Tower B · Lot P3",
    siteKey: "tower-b",
    warrantyStatus: "active",
    monthsLeft: 18,
    progress: 0.75,
  },
  {
    id: "FR8-2290",
    name: "Face Recognition FR-8",
    serialLabel: "SN FR8-2290-11 · FW 3.4.1",
    site: "HQ · Lobby",
    siteKey: "hq",
    warrantyStatus: "active",
    monthsLeft: 10,
    progress: 0.4,
  },
  {
    id: "FB2-0391",
    name: "Flap Barrier FB-2 × 6",
    serialLabel: "SN FB2-0391-01 → 06",
    site: "Campus · Gate A",
    siteKey: "campus",
    warrantyStatus: "expiring",
    daysLeft: 28,
    progress: 0.06,
  },
];


export const warranties: Record<string, WarrantyDetail> = {
  "BG5-0418": {
    productId: "BG5-0418",
    certificate: "WR-88A1-2290",
    plan: "Active · Standard 2-year",
    productName: "Barrier Gate BG-500",
    serial: "SN BG5-0418-02 · Installed 18 Apr 2026",
    installedLabel: "18 Apr 2026",
    monthsRemaining: 18,
    termMonths: 24,
    periodLabel: "18 Apr 2026 → 18 Apr 2028",
    extendLabel: "Extend to 5 years · from Rp 2.100.000",
    coverage: [
      { title: "Parts & components", detail: "Motor, controller, arm, sensors", covered: true, icon: "parts" },
      { title: "Labor & on-site visits", detail: "Within Jabodetabek, response < 24h", covered: true, icon: "labor" },
      { title: "Firmware updates", detail: "Over-the-air, lifetime", covered: true, icon: "firmware" },
      { title: "Damage from power surge / vandalism", detail: "Not covered · optional add-on", covered: false, icon: "damage" },
    ],
    history: [
      { title: "Preventive maintenance", detail: "Agus · lubrication, sensor check — OK", dateLabel: "12 Oct" },
      { title: "Firmware 3.4.1 installed", detail: "Remote update · no downtime", dateLabel: "2 Sep" },
      { title: "Installed & warranty activated", detail: "Certificate WR-88A1-2290 issued", dateLabel: "18 Apr" },
    ],
    certificateFile: { id: "doc_wr2290", name: "Warranty Certificate.pdf", meta: "PDF · 210 KB", kind: "pdf" },
  },
};

export const serviceTypes: ServiceType[] = [
  { id: "repair", name: "Repair", priceLabel: "From Rp 450.000" },
  { id: "maintenance", name: "Maintenance", priceLabel: "Covered" },
  { id: "inspection", name: "Inspection", priceLabel: "Rp 350.000" },
];

const slots = (full: string[] = []) =>
  ["08:00", "09:00", "10:00", "13:00", "14:00", "15:00"].map((time) => ({ time, available: !full.includes(time) }));

export const serviceDays: ServiceDay[] = [
  { date: "2026-10-27", weekday: "Mon", day: 27, available: false, slots: slots(["08:00", "09:00", "10:00", "13:00", "14:00", "15:00"]) },
  { date: "2026-10-28", weekday: "Tue", day: 28, available: true, slots: slots(["08:00"]) },
  { date: "2026-10-29", weekday: "Wed", day: 29, available: true, slots: slots(["13:00", "14:00"]) },
  { date: "2026-10-30", weekday: "Thu", day: 30, available: true, slots: slots(["14:00"]) },
  { date: "2026-10-31", weekday: "Fri", day: 31, available: true, slots: slots(["10:00"]) },
  { date: "2026-11-01", weekday: "Sat", day: 1, available: false, slots: slots(["08:00", "09:00", "10:00", "13:00", "14:00", "15:00"]) },
];

export const serviceSite = { name: "Grand Indonesia Tower B", detail: "Basement P3 · PIC Andi · 0812 •••• 2210" };

export const notifications: PortalNotification[] = [
  {
    id: "n1",
    group: "today",
    kind: "support",
    title: "Support replied",
    body: "Rina: “The barrier arm sensor needs recalibration…” on #TCK-2241",
    ago: "12m",
    unread: true,
    href: "/support/TCK-2241",
  },
  {
    id: "n2",
    group: "today",
    kind: "quotation",
    title: "Quotation awaiting approval",
    body: "QT-2026-0912 · Parking Guidance Lot P3 expires in 6 days.",
    ago: "1h",
    unread: true,
    href: "/quotations/QT-2026-0912",
  },
  {
    id: "n3",
    group: "today",
    kind: "payment",
    title: "Payment confirmed",
    body: "We received Rp 92.000.000 for INV-0412. Receipt is ready.",
    ago: "2h",
    unread: false,
    href: "/payments",
  },
  {
    id: "n4",
    group: "earlier",
    kind: "order",
    title: "Order shipped",
    body: "#ENT-0418 picked up by JNE Cargo · ETA Thu, 29 Oct",
    ago: "Yesterday",
    unread: false,
    href: "/orders/ENT-2026-0418",
  },
  {
    id: "n5",
    group: "earlier",
    kind: "project",
    title: "Project milestone reached",
    body: "Smart Parking · Stage 3 “Cabling & conduit” completed.",
    ago: "Mon",
    unread: false,
    href: "/projects/PRJ-2026-031",
  },
  {
    id: "n6",
    group: "earlier",
    kind: "warranty",
    title: "Warranty registered",
    body: "ANPR Camera AC-200 · SN 88A1-2290 covered until Oct 2028.",
    ago: "Sun",
    unread: false,
    href: "/products",
  },
];

export const home: Omit<HomeSummary, "quotations" | "openTickets" | "unreadNotifications"> = {
  activeProject: { ...projects[0], index: 2, total: 3 },
  nextDelivery: {
    ...orders[0],
    title: "Barrier Gate × 4",
    arrivesLabel: "Arrives Thu, 29 Oct",
    stages: ["Confirmed", "Produced", "QC", "Shipped", "Installed"],
    currentStage: 3,
  },
  activity: [
    { kind: "payment", title: "Payment confirmed", detail: "Invoice INV-0412 · Rp 92.000.000 · 2h ago" },
    { kind: "shipment", title: "Shipment picked up by JNE Cargo", detail: "Order #ENT-0418 · Yesterday" },
    { kind: "quotation", title: "Quotation QT-0912 issued", detail: "Sales · Dimas Pratama · 2 days ago" },
  ],
  accountManager: { name: "Dimas Pratama", initials: "DP", statusLabel: "Your account manager · Online", phone: "+62215550142", email: "dimas.pratama@entragate.com" },
};

export const profile: ProfileSummary = {
  stats: { orders: 12, projects: 3, devices: 28, tickets: 2 },
  quotationsAwaiting: 1,
  outstanding: 190_900_000,
  orderCount: 12,
  memberSince: "2024",
  deviceCount: 28,
  siteCount: 4,
  warrantyExpiring: 1,
  nextBookingLabel: "Thu 30 Oct, 09:00",
  documentCount: 86,
  memberCount: 5,
  approverCount: 2,
};

export const documentLibrary: DocumentLibrary = {
  total: 86,
  folders: [
    { key: "invoices", label: "Invoices & receipts", count: 24 },
    { key: "quotations", label: "Quotations", count: 12 },
    { key: "warranty", label: "Warranty certificates", count: 28 },
    { key: "drawings", label: "Drawings & reports", count: 22 },
  ],
  files: [
    { id: "doc_w43", name: "Progress Report W43.pdf", meta: "Smart Parking · 2.4 MB · Today", kind: "pdf", folder: "drawings" },
    { id: "doc_qt0912", name: "Quotation QT-2026-0912.pdf", meta: "Sales · 412 KB · 25 Oct", kind: "pdf", folder: "quotations" },
    { id: "doc_inv0431", name: "Invoice INV-2026-0431.pdf", meta: "Finance · 188 KB · 24 Oct", kind: "pdf", folder: "invoices" },
    { id: "doc_asb", name: "As-built Drawing Rev.B.dwg", meta: "Smart Parking · 8.1 MB · 16 Oct", kind: "dwg", folder: "drawings" },
    { id: "doc_wc500", name: "Warranty Cards BG-500.zip", meta: "4 certificates · 1.2 MB", kind: "zip", folder: "warranty" },
  ],
};
