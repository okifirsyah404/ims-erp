# Entragate platform: public website and customer portal

The customer-facing side of Entragate, moved into the ERP monorepo on
2026-11-15 (it was the separate `entragate-platform` repository). It is not
a nested monorepo any more: its apps and packages are workspaces of the root
`package.json`, with one `bun install` and one `bun.lock` at the repo root.

| Path | Package | What | Dev port |
| --- | --- | --- | --- |
| `apps/web` | `@ims-erp/web` | Public website and landing page (Astro, SSR) | 4321 |
| `apps/customer` | `@ims-erp/customer` | Customer portal (Astro + React islands, PWA) | 4322 |
| `packages/api-client` | `@ims-erp/api-client` | Typed clients for the ERP `/public/v1` and `/portal/v1` APIs | — |
| `packages/design-tokens` | `@ims-erp/design-tokens` | Shared design tokens | — |

## Commands (from the repo root)

```bash
bun install                  # the whole monorepo, one lockfile
bun run dev:website          # apps/web on :4321
bun run dev:portal           # apps/customer on :4322
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

`designs/` holds the Pencil source (`entragate-final.pen`, ~14 MB) and its
exports. It is **not in git** (root `.gitignore`). Keep the `.pen` file in the
team's shared drive and copy it here locally when you need it.
