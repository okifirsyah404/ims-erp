import { PUBLIC_WHATSAPP_NUMBER } from "astro:env/client";
import { customerUrl } from "../lib/urls";

/**
 * Public route map. Each route corresponds to a frame in designs/entragate-final.pen
 * (see docs comment per entry). Routes not built yet still resolve here so links
 * stay consistent while pages are implemented progressively.
 */
export const routes = {
  home: "/", // 01.01 Home
  products: "/products", // 02.01 Product Catalog
  solutions: "/solutions", // 02.04 Software Solutions
  demo: "/solutions/demo", // 02.05 Request Software Demo
  projects: "/projects", // 01.02 Project Portfolio
  track: "/track", // 07.04 Public Tracking Entry
  about: "/about", // 09.01 About CV. Inti Multi Solusi
  contact: "/contact", // 09.02 Contact
  quote: "/quote", // 03.02 RFQ & Pricing
  help: "/help", // 01.03 Knowledge Center · Help & FAQ
  documents: "/help/documents", // 01.04 Knowledge Center · Documents & Downloads
  videos: "/help/videos", // Knowledge Center · Video Guides (tab in 01.03/01.04)
  training: "/help/training", // Knowledge Center · Training & Certification
  search: "/search",
  cart: "/cart", // 03.03 Checkout · step 1
  checkout: "/checkout", // 03.03 Checkout
  build: "/build", // 03.01 Build Your Solution
  compare: "/products/compare", // 02.03 Product Comparison
  careers: "/careers",
  news: "/news",
  warranty: "/warranty",
  installation: "/installation",
  privacy: "/privacy",
  terms: "/terms",
} as const;

/** 02.04 solution detail pages. */
export const solutionHref = (slug: string) => `${routes.solutions}/${slug}`;

/** Customer Portal URLs (env-based: localhost:4322 in development). */
export const customerPortal = {
  home: `${customerUrl}/`,
  login: `${customerUrl}/login`,
  register: `${customerUrl}/register`,
  newTicket: `${customerUrl}/support/new`,
  orders: `${customerUrl}/orders`,
  quotations: `${customerUrl}/quotations`,
  /** Guest RFQ → account, after email verification in the portal. */
  claimRfq: (reference: string) => `${customerUrl}/quotations/claim?reference=${encodeURIComponent(reference)}`,
} as const;

/** Website sign-in hand-off (portal login/register, then back here). */
export const authRoutes = {
  login: (next = "/") => `/auth/login?next=${encodeURIComponent(next)}`,
  register: (next = "/") => `/auth/login?mode=register&next=${encodeURIComponent(next)}`,
  logout: "/auth/logout",
} as const;

export type NavItem = {
  label: string;
  href: string;
  /** Rendered with a chevron in the approved header (menu content pending design). */
  hasMenu?: boolean;
};

export const mainNav: NavItem[] = [
  { label: "Home", href: routes.home },
  { label: "Products", href: routes.products, hasMenu: true },
  { label: "Software Solutions", href: routes.solutions, hasMenu: true },
  { label: "Projects", href: routes.projects },
  { label: "Track Order", href: routes.track },
  { label: "About IMS", href: routes.about },
  { label: "Contact", href: routes.contact },
];

export const company = {
  brand: "ENTRAGATE",
  legalName: "CV. Inti Multi Solusi",
  tagline: "by CV. Inti Multi Solusi",
  address: "Jl. Raya Industri No. 88, Bekasi, Jawa Barat",
  showroom: "Bekasi, Jawa Barat",
  phone: "+62 21 8899 2020",
  phoneHref: "tel:+622188992020",
  email: "sales@entragate.co.id",
  whatsapp: `+${PUBLIC_WHATSAPP_NUMBER.replace(/^(\d{2})(\d{3})(\d{4})(\d+)$/, "$1 $2 $3 $4")}`,
  whatsappHref: `https://wa.me/${PUBLIC_WHATSAPP_NUMBER}`,
  hotlineHours: "Mon–Fri · 08:00–17:00",
  /** Technical support line (01.03 · Still need help?). */
  supportWhatsapp: "+62 811 1900 288",
  supportWhatsappHref: "https://wa.me/628111900288",
  supportEmail: "support@entragate.co.id",
  headOffice: {
    title: "Head office & warehouse",
    address: "Jl. Raya Narogong KM 12, Bantargebang, Bekasi, Jawa Barat 17151",
    note: "Showroom visits by appointment · Mon–Sat",
  },
};

/** Networks the ERP can set (ERP-0071); the built-in list uses the first four. */
export type SocialKey = "instagram" | "linkedin" | "youtube" | "whatsapp" | "facebook" | "tiktok" | "x";

/** TODO(content): official social profile URLs. Empty entries render as non-link icons. */
export const socials: { key: SocialKey; label: string; href?: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "youtube", label: "YouTube" },
  { key: "whatsapp", label: "WhatsApp", href: company.whatsappHref },
];

export type FooterColumn = { title: string; links: { label: string; href: string }[] };

export const footerColumns: FooterColumn[] = [
  {
    title: "Products",
    links: [
      { label: "Swing Barrier Gate", href: `${routes.products}?category=swing-barrier-gate` },
      { label: "Flap Barrier Gate", href: `${routes.products}?category=flap-barrier-gate` },
      { label: "Tripod Turnstile", href: `${routes.products}?category=tripod-turnstile` },
      { label: "Parking Barrier", href: `${routes.products}?category=parking-barrier` },
      { label: "Face Recognition", href: `${routes.products}?category=face-recognition` },
      { label: "Access Controllers", href: `${routes.products}?category=access-controllers` },
    ],
  },
  {
    title: "Software",
    links: [
      { label: "Gym Management", href: `${routes.solutions}/gym-management` },
      { label: "E-Ticketing", href: `${routes.solutions}/e-ticketing` },
      { label: "Visitor Management", href: `${routes.solutions}/visitor-management` },
      { label: "Library Management", href: `${routes.solutions}/library-management` },
      { label: "Smart Parking", href: `${routes.solutions}/smart-parking` },
      { label: "Access Control", href: `${routes.solutions}/access-control` },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About IMS", href: routes.about },
      { label: "Projects", href: routes.projects },
      { label: "Careers", href: routes.careers },
      { label: "News & Insights", href: routes.news },
      { label: "Contact", href: routes.contact },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Track Order", href: routes.track },
      { label: "Warranty Claim", href: routes.warranty },
      { label: "Installation", href: routes.installation },
      { label: "Documentation", href: routes.documents },
      { label: "FAQ", href: routes.help },
      { label: "Customer Portal", href: customerPortal.home },
      { label: "Support Center", href: routes.help },
    ],
  },
];

/** Condensed columns used by the Mobile Footer component (r1UR5t). */
export const mobileFooterColumns: FooterColumn[] = [
  {
    title: "Products",
    links: [
      { label: "Barrier Gates", href: routes.products },
      { label: "Turnstiles", href: `${routes.products}?category=tripod-turnstile` },
      { label: "Parking", href: `${routes.products}?category=parking-barrier` },
      { label: "Face Recognition", href: `${routes.products}?category=face-recognition` },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About IMS", href: routes.about },
      { label: "Projects", href: routes.projects },
      { label: "Track Order", href: routes.track },
      { label: "Contact", href: routes.contact },
      { label: "Customer Portal", href: customerPortal.home },
    ],
  },
];
