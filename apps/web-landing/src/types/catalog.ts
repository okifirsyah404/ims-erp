import { type CatalogProduct, type CatalogStockStatus } from "@/api/catalog";
import type { IconName } from "../lib/icons";

/**
 * View models for catalog UI. These describe what the components render, not the
 * ERP payloads — ERP DTOs will be mapped into these once endpoints are confirmed.
 */
export type StockStatus = CatalogStockStatus;

/** Card-level product; the shape is the shared ERP catalog contract (`CatalogProduct`). */
export type ProductSummary = CatalogProduct;

export type CategorySummary = {
  slug: string;
  name: string;
  productCount: string;
  image?: string;
};

export type CatalogCategory = {
  slug: string;
  /** Full name used in the filter list. */
  name: string;
  /** Label used by the hero chips. */
  chipLabel: string;
  /** Label used by the mobile chips (falls back to chipLabel). */
  mobileChipLabel?: string;
  icon: IconName;
};

export type ProductOption = {
  name: string;
  choices: { value: string; label: string; mobileLabel?: string }[];
  defaultValue: string;
};

export type ProductFeature = {
  icon: IconName;
  title: string;
  description: string;
  mobileTitle: string;
  mobileDescription: string;
};

export type ProductSpec = { label: string; value: string; mobileLabel?: string; mobileValue?: string; mobile?: boolean };

export type ProductDetail = {
  slug: string;
  /** Short label for the mobile breadcrumb, e.g. "S200". */
  shortName?: string;
  eyebrow: string;
  model: string;
  reviewCount: number;
  summary: string;
  stockLabel: string;
  bestSeller?: boolean;
  priceUnit: string;
  mobilePriceUnit: string;
  priceNote: string;
  mobilePriceNote: string;
  options: ProductOption[];
  gallery: (string | undefined)[];
  hasVideo?: boolean;
  overviewTitle: string;
  overview: string;
  mobileOverview: string;
  features: ProductFeature[];
  specs: ProductSpec[];
  datasheetUrl?: string;
  band?: {
    eyebrow: string;
    title: string;
    stats: { value: string; label: string }[];
    image?: string;
  };
  related: string[];
};
