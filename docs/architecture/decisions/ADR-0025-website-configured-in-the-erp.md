# ADR-0025 - The Public Website Is Configured in the ERP (Commerce Module)

- **Status:** proposed (2026-11-19). Records the user's decisions of
  2026-11-19 (ERP-0071); becomes accepted with the owner's review of the PR.
  Number checked against `origin/main` and every remote branch on 2026-11-19
  (highest in use: ADR-0023 there, ADR-0024 on this branch).
- **Context:** The website (`apps/web-landing`) had its identity, contact,
  social links, SEO defaults, header menu and footer columns hardcoded in
  `src/data/site.ts`, and every page without `prerender = false` was built
  statically. The user asked for the landing page to become dynamic, step by
  step, configured from the ERP; stage 1 is identity and navigation. The
  canonical `docs.dbml` already designed `commerce.web_menus` /
  `web_menu_items` (and `web_pages`), but tenant-scoped with
  `organization_id NOT NULL`, while the only built website table,
  `catalog.web_listings`, is company-wide (ADR-0012).
- **Decision:**
  1. **A `commerce` module owns the website's content tables**, built in
     stages. Stage 1 builds `commerce.web_sites` (one live row: identity,
     contact, social links, default SEO — a table added to `docs.dbml`) and
     the designed `commerce.web_menus` / `web_menu_items` (user decision:
     the designed tables, not key/value company settings).
  2. **Company-wide, no `organization_id`** (ADR-0012, like
     `catalog.web_listings`): the public website belongs to the company. The
     `docs.dbml` definitions were changed accordingly before the Drizzle
     schema; `web_menu_items.web_page_id` stays in the target and lands with
     `web_pages` (stage 4).
  3. **Menus are replaced whole.** The web admin edits `main` (header) and
     `footer` (child menus are the footer columns) and saves the full tree;
     the old children and items are soft-deleted in the same transaction.
     Links are site paths or `https:` / `mailto:` / `tel:` links only.
  4. **One public read, `GET /public/v1/site`,** with the website API key
     (`publicApi`, config `website`, prefix `ewk_`). The web admin creates
     and revokes those keys (`/website/keys`, owner through
     `integration:configure`; Better Auth also checks the member's
     `apiKey` permission). Content uses the website catalog permissions
     (`catalog:read|update`: marketing, admin, owner) — no new permission.
  5. **The website renders on request** (`output: "server"`): a middleware
     puts the configuration on `Astro.locals.site`, cached for a minute in
     ERP mode; any field the ERP has not set keeps the built-in default, and
     an ERP outage serves the last good copy. Dynamic detail pages
     (`news`, `projects`, `solutions`, help) no longer use `getStaticPaths`
     and answer an unknown slug with the 404 page.
- **Consequences:**
  - A change saved in the web admin shows on the website within a minute,
    without a rebuild.
  - Every page is rendered by the Node server (static assets stay static);
    the one-minute cache keeps the ERP call to one per minute per instance.
  - Stages 2-4 (home sections; solutions, projects, testimonials; other
    content pages) follow the same pattern: a `commerce` table, a field in
    the public read, a web admin screen, the website adapter with defaults.
- **Amendment (stage 2, 2026-11-19):** all content pages and collections
  share one table, `commerce.web_pages` (`page_type`, `slug`, `content`
  jsonb), instead of a table per section. The shape of each type lives in
  one registry in `packages/common` that validates saves in the ERP and
  renders the web admin form; the website reads published entries only and
  merges them field by field over its built-in content. Images are uploaded
  to the ERP (`commerce.web_assets`, WebP) and served through a public
  redirect. Testimonials are their own collection linked to a project by
  slug.
