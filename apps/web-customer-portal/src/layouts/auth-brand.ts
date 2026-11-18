/** Desktop auth brand panel copy (04.01–04.06 Desktop), keyed by screen. */
export type AuthBrand = {
  eyebrow: string;
  headline: string;
  description: string;
  stats?: { value: string; label: string }[];
};

export const authBrands = {
  login: {
    eyebrow: "Customer portal",
    headline: "Every entrance, managed from one portal.",
    description: "Track orders, approve quotations, manage warranties and raise support tickets for every Entragate site your company operates.",
    stats: [
      { value: "1,200+", label: "Sites managed" },
      { value: "24/7", label: "Technical support" },
      { value: "99.2%", label: "SLA uptime" },
    ],
  },
  register: {
    eyebrow: "Create account",
    headline: "Built for the teams who keep Indonesia moving.",
    description: "Property managers, campuses, gyms and government offices rely on Entragate to secure millions of entries every day.",
    stats: [
      { value: "850+", label: "Corporate clients" },
      { value: "34", label: "Provinces served" },
      { value: "12 yrs", label: "In access control" },
    ],
  },
  business: {
    eyebrow: "Business account",
    headline: "One account for every site, team and invoice.",
    description: "Bring procurement, facility and finance teams together — with approval limits, tax-ready invoices and a dedicated account manager.",
    stats: [
      { value: "Net-30", label: "Payment terms" },
      { value: "e-Faktur", label: "Tax invoices" },
      { value: "1 hr", label: "Manager response" },
    ],
  },
  forgot: {
    eyebrow: "Account recovery",
    headline: "Locked out? We’ll get you back in minutes.",
    description: "For your security, reset links are single-use, expire after 30 minutes and are only sent to verified work emails.",
  },
  reset: {
    eyebrow: "Account recovery",
    headline: "A stronger password keeps every site secure.",
    description: "Your Entragate account controls gate access settings, purchase approvals and warranty records — protect it accordingly.",
  },
  verify: {
    eyebrow: "Almost there",
    headline: "Verify once. Manage every site with confidence.",
    description: "Verified work emails let us send quotations, Faktur Pajak and service reports straight to the right people in your company.",
    stats: [
      { value: "2 min", label: "Average setup" },
      { value: "4", label: "Team seats included" },
      { value: "Free", label: "Site survey" },
    ],
  },
} satisfies Record<string, AuthBrand>;
