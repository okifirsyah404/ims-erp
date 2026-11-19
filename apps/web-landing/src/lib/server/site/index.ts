import { createApiClient } from "@/api/client";
import { company, footerColumns, mainNav, mobileFooterColumns, routes, socials, type FooterColumn, type NavItem, type SocialKey } from "@/data/site";
import { ERP_API_BASE_URL, ERP_API_TIMEOUT_MS, ERP_API_TOKEN, ERP_RESPONSE_ENVELOPE } from "astro:env/server";
import { websiteMode } from "../website";

/**
 * The website's identity, contact, social links, default SEO and menus (ERP-0071 stage 1).
 *
 * In ERP mode they come from `GET /public/v1/site` (website API key), cached for a minute;
 * every field the ERP has not set keeps the built-in default from `data/site.ts`, and an
 * ERP outage serves the last good copy (or the defaults) instead of breaking the page.
 * Demo mode always uses the defaults.
 */
export type SiteSocial = { key: SocialKey; label: string; href?: string };
export type SiteConfig = {
  company: typeof company;
  socials: SiteSocial[];
  mainNav: NavItem[];
  footerColumns: FooterColumn[];
  mobileFooterColumns: FooterColumn[];
  seo: { title: string | null; description: string | null };
};

type ErpMenuItem = { label: string; url: string };
type ErpMenu = { name: string; items: ErpMenuItem[]; children: { name: string; items: ErpMenuItem[] }[] };
type ErpSite = {
  site: {
    brandName: string;
    legalName: string | null;
    tagline: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    whatsapp: string | null;
    hotlineHours: string | null;
    supportEmail: string | null;
    supportWhatsapp: string | null;
    socialLinks: { key: SiteSocial["key"]; url: string }[];
    defaultSeoTitle: string | null;
    defaultSeoDescription: string | null;
  } | null;
  menus: { main?: ErpMenu; footer?: ErpMenu };
};

const DEFAULTS: SiteConfig = {
  company,
  socials,
  mainNav,
  footerColumns,
  mobileFooterColumns,
  seo: { title: null, description: null },
};

const SOCIAL_LABELS: Record<SiteSocial["key"], string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  facebook: "Facebook",
  tiktok: "TikTok",
  x: "X",
  whatsapp: "WhatsApp",
};

/** Header entries that open the products / solutions mega menu. */
const MEGA_MENU_HREFS = new Set<string>([routes.products, routes.solutions]);

const digits = (value: string) => value.replace(/[^\d]/g, "");
const tel = (phone: string) => `tel:+${digits(phone).replace(/^0/, "62")}`;
const wa = (phone: string) => `https://wa.me/${digits(phone).replace(/^0/, "62")}`;
/** Only site paths and https / mailto / tel links reach an `href` (the ERP validates too). */
const safeHref = (url: string) => (/^\/(?!\/)|^https:\/\/|^mailto:|^tel:/i.test(url) ? url : "#");

function merge(erp: ErpSite): SiteConfig {
  const site = erp.site;
  const pick = <T>(value: T | null | undefined, fallback: T) => (value === null || value === undefined || value === "" ? fallback : value);
  const merged: typeof company = site
    ? {
        ...company,
        brand: pick(site.brandName, company.brand),
        legalName: pick(site.legalName, company.legalName),
        tagline: pick(site.tagline, company.tagline),
        address: pick(site.address, company.address),
        phone: pick(site.phone, company.phone),
        phoneHref: site.phone ? tel(site.phone) : company.phoneHref,
        email: pick(site.email, company.email),
        whatsapp: pick(site.whatsapp, company.whatsapp),
        whatsappHref: site.whatsapp ? wa(site.whatsapp) : company.whatsappHref,
        hotlineHours: pick(site.hotlineHours, company.hotlineHours),
        supportEmail: pick(site.supportEmail, company.supportEmail),
        supportWhatsapp: pick(site.supportWhatsapp, company.supportWhatsapp),
        supportWhatsappHref: site.supportWhatsapp ? wa(site.supportWhatsapp) : company.supportWhatsappHref,
      }
    : company;
  const columns = (menu: ErpMenu | undefined): FooterColumn[] | null =>
    menu && menu.children.length > 0
      ? menu.children.map((child) => ({ title: child.name, links: child.items.map((item) => ({ label: item.label, href: safeHref(item.url) })) }))
      : null;
  const footer = columns(erp.menus.footer);
  return {
    company: merged,
    socials:
      site && site.socialLinks.length > 0
        ? site.socialLinks.map((link) => ({ key: link.key, label: SOCIAL_LABELS[link.key] ?? link.key, href: safeHref(link.url) }))
        : socials,
    mainNav:
      erp.menus.main && erp.menus.main.items.length > 0
        ? erp.menus.main.items.map((item) => ({ label: item.label, href: safeHref(item.url), hasMenu: MEGA_MENU_HREFS.has(item.url) }))
        : mainNav,
    footerColumns: footer ?? footerColumns,
    mobileFooterColumns: footer ? footer.slice(0, 3).map((column) => ({ ...column, links: column.links.slice(0, 4) })) : mobileFooterColumns,
    seo: { title: site?.defaultSeoTitle ?? null, description: site?.defaultSeoDescription ?? null },
  };
}

const TTL_MS = 60_000;
let cache: { at: number; value: SiteConfig } | null = null;
let inflight: Promise<SiteConfig> | null = null;

async function load(): Promise<SiteConfig> {
  if (!ERP_API_BASE_URL || !ERP_API_TOKEN) return DEFAULTS;
  const client = createApiClient({
    baseUrl: ERP_API_BASE_URL,
    token: ERP_API_TOKEN,
    timeoutMs: Math.min(ERP_API_TIMEOUT_MS ?? 5_000, 5_000),
    unwrap: ERP_RESPONSE_ENVELOPE === "data" ? (body) => (body as { data?: unknown } | undefined)?.data : undefined,
    defaultHeaders: { "X-Client": "entragate-website" },
  });
  return merge(await client.get<ErpSite>("/public/v1/site"));
}

/** The site configuration for this request (cached for a minute in ERP mode). */
export async function getSiteConfig(): Promise<SiteConfig> {
  if (websiteMode === "demo") return DEFAULTS;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  inflight ??= load()
    .then((value) => {
      cache = { at: Date.now(), value };
      return value;
    })
    .catch((error: unknown) => {
      console.error("[site] ERP site configuration unavailable; serving the last good copy", error);
      return cache?.value ?? DEFAULTS;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
