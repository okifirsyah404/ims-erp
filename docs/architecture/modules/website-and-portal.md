# Website and customer portal

The customer-facing side of Entragate. It lives in this monorepo as root
workspaces: one `bun install`, one `bun.lock`. It was the separate
`entragate-platform` repository until 2026-11-15.

| Path | Package | What | Dev port |
| --- | --- | --- | --- |
| `apps/web-landing` | `@ims-erp/web-landing` | Public website and landing page (Astro, SSR) | 4321 |
| `apps/web-customer-portal` | `@ims-erp/web-customer-portal` | Customer portal (Astro + React islands, PWA) | 4322 |
| `apps/web-landing/src/api/` | — | ERP contract clients and schemas for the website (`client.ts`, `website.ts`, `catalog.ts`, `rfq.ts`) | - |
| `apps/web-customer-portal/src/api/` | — | ERP contract clients and schemas for the portal (`client.ts`, `portal.ts`, `portal-schemas.ts`) | - |
| `packages/design-tokens` | `@ims-erp/design-tokens` | Shared design tokens | - |

## Commands (from the repo root)

```bash
bun install                  # the whole monorepo, one lockfile
bun run dev:website          # apps/web-landing on :4321
bun run dev:portal           # apps/web-customer-portal on :4322
bun run dev                  # turbo: backend, web-admin, website and portal
bun run typecheck            # turbo; the Astro apps run `astro check`
bun run build                # turbo; the Astro apps run `astro build`
```

## Configuration

Each app has a `.env.example`. Copy it to `.env` in the same folder. `.env` is
git-ignored; never commit it. The portal and the website reach the ERP
**server to server** only (the browser never calls the ERP).

API reference: the backend serves the OpenAPI document at `/docs`
(`@elysia/openapi`). The portal routes are documented in
`docs/architecture/modules/customer-portal.md`, the website integration design
in `docs/plan/plans/website-integration.md`, and the license API spec is
`docs/architecture/api/licensing.yaml`.

## Design files

The Pencil source (`entragate-final.pen`, ~14 MB) is **not in git**. Keep it on
the team's shared drive and copy it into `apps/web-landing/designs/` or
`apps/web-customer-portal/designs/` locally when you need it (both ignored by
the root `.gitignore`).
