import { defineMiddleware } from "astro:middleware";
import { getSiteConfig } from "./lib/server/site";

/**
 * Puts the website's identity, contact, social links, default SEO and menus (ERP-0071,
 * configured in the ERP) on `Astro.locals.site` for every rendered page.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.site = await getSiteConfig();
  return next();
});
