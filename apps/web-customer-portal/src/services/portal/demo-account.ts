import { type AccountSettings, type InvoiceDetail, type WishlistItem } from "@/api/portal";

/**
 * DEMO FIXTURES for account, company, wishlist and invoice detail screens (05.10, 05.11,
 * 06.07, invoices). Copy and numbers come from the approved frames. Development only.
 */

export const account: AccountSettings = {
  personal: { name: "Hendra Wijaya", email: "hendra@majulogistik.co.id", phone: "+62 812 3456 7890", jobTitle: "Procurement Manager" },
  company: {
    name: "PT Maju Logistik Nusantara",
    shortName: "ML",
    npwp: "01.234.567.8-901.000",
    industry: "Logistics & Warehousing",
    verified: true,
    approvalRule: "Quotations above Rp 100.000.000 need 2 approvals before acceptance.",
  },
  members: [
    { id: "m-hendra", name: "Hendra Wijaya", email: "hendra@majulogistik.co.id", initials: "HW", title: "Procurement Manager", role: "owner", admin: true, status: "active", lastActiveLabel: "Active now" },
    { id: "m-rina", name: "Rina Kusuma", email: "rina@majulogistik.co.id", initials: "RK", title: "Approval limit Rp 250.000.000", role: "approver", approvalLimit: 250_000_000, status: "active", lastActiveLabel: "2h ago" },
    { id: "m-dewi", name: "Dewi Sartika", email: "dewi@majulogistik.co.id", initials: "DS", title: "Finance · invoices & payments", role: "finance", status: "active", lastActiveLabel: "Yesterday" },
    { id: "m-andi", name: "Andi Saputra", email: "andi@majulogistik.co.id", initials: "AS", title: "Facility staff · tracking only", role: "viewer", status: "active", lastActiveLabel: "3 days ago" },
    { id: "m-budi", email: "budi@majulogistik.co.id", initials: "BS", title: "Invitation sent 2 days ago", role: "viewer", status: "invited", lastActiveLabel: "Invited" },
  ],
  sites: [
    { id: "site-hq", name: "Head Office", address: "Jl. Raya Bekasi KM 21, Cakung, Jakarta Timur 13910", picName: "Andi (Facility)", picPhone: "0812 3456 2210", primary: true },
    { id: "site-gi", name: "Grand Indonesia Tower B", address: "Basement P3, Jl. M.H. Thamrin No. 1, Jakarta Pusat 10310", picName: "Andi", picPhone: "0812 •••• 2210" },
    { id: "site-campus", name: "Campus · Gate A", address: "Jl. Raya Bogor KM 30, Depok 16451", picName: "Yudi", picPhone: "0813 2290 1180" },
    { id: "site-wh", name: "Warehouse Cikarang", address: "Kawasan Industri Jababeka Blok F, Cikarang 17530", picName: "Rahmat", picPhone: "0811 7720 3301" },
  ],
  notifications: { push: true, email: true, whatsapp: false },
  security: { twoStep: false, passwordChangedLabel: "Last changed 3 months ago", activeDevices: 2 },
  preferences: { language: "en", currency: "IDR" },
};

export const wishlist: WishlistItem[] = [
  { id: "w1", productSlug: "eg-swing-s300-dual", name: "EG-Swing S300 Dual", category: "Swing Barrier Gate", priceLabel: "Rp 45.900.000", stock: "preorder", addedLabel: "Saved 2 days ago" },
  { id: "w2", productSlug: "eg-face-pro-2", name: "EG-Face Pro 2", category: "Face Recognition", priceLabel: "Rp 6.750.000", stock: "preorder", addedLabel: "Saved last week" },
  { id: "w3", productSlug: "eg-pay-k5-exit-kiosk", name: "EG-Pay K5 Exit Kiosk", category: "Parking Equipment", priceLabel: "Project price", stock: "request", addedLabel: "Saved 3 weeks ago" },
];

export const invoiceDetails: Record<string, Omit<InvoiceDetail, "id" | "number" | "description" | "amount" | "status" | "dueLabel" | "dueDate">> = {
  "INV-2026-0431": {
    issuedLabel: "Issued 27 Oct 2026",
    orderNumber: "ENT-2026-0418",
    lines: [
      { label: "Barrier Gate BG-500 × 4", detail: "Delivery milestone 60%", amount: 157_200_000 },
      { label: "Installation & commissioning", detail: "Delivery milestone 60%", amount: 14_800_000 },
    ],
    subtotal: 172_000_000,
    tax: 18_926_000,
    total: 190_926_000,
    payments: [],
    milestones: [
      { label: "Down payment 30%", amount: 92_000_000, status: "paid", dateLabel: "Paid 14 Oct" },
      { label: "On delivery 60%", amount: 190_926_000, status: "due", dateLabel: "Due 3 Nov" },
      { label: "Handover 10%", amount: 31_821_000, status: "upcoming", dateLabel: "After commissioning" },
    ],
    document: { id: "doc-inv-0431", name: "Invoice INV-2026-0431.pdf", meta: "PDF · 182 KB", kind: "pdf" },
  },
  "INV-2026-0412": {
    issuedLabel: "Issued 12 Oct 2026",
    orderNumber: "ENT-2026-0418",
    lines: [{ label: "Barrier Gate BG-500 × 4", detail: "Down payment 30%", amount: 82_882_883 }],
    subtotal: 82_882_883,
    tax: 9_117_117,
    total: 92_000_000,
    payments: [{ label: "Payment received", dateLabel: "14 Oct 2026, 10:12", amount: 92_000_000, method: "BCA Virtual Account" }],
    milestones: [],
    document: { id: "doc-inv-0412", name: "Invoice INV-2026-0412.pdf", meta: "PDF · 176 KB", kind: "pdf" },
  },
  "INV-2026-0398": {
    issuedLabel: "Issued 20 Sep 2026",
    orderNumber: "ENT-2026-0377",
    lines: [{ label: "RFID / QR Reader RQ-1 × 20", amount: 28_648_649 }],
    subtotal: 28_648_649,
    tax: 3_151_351,
    total: 31_800_000,
    payments: [{ label: "Payment received", dateLabel: "22 Sep 2026, 15:40", amount: 31_800_000, method: "QRIS" }],
    milestones: [],
    document: { id: "doc-inv-0398", name: "Invoice INV-2026-0398.pdf", meta: "PDF · 161 KB", kind: "pdf" },
  },
};
