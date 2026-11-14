---
title: Website setup
---

## Customer portal (`apps/customer`)

`.env`:

```bash
PORTAL_DATA_SOURCE=erp
ERP_API_BASE_URL=https://<erp-host>      # http://localhost:3000 in development
ERP_RESPONSE_ENVELOPE=data
ERP_ASSET_ORIGINS=https://<object-storage-host>
```

The route map is `src/services/portal/erp-routes.ts`: each `PortalSource`
operation points at its path in the [API Reference](/api). Operations that
are not mapped throw `PortalNotConfiguredError`; screens that need them show
**Coming soon** (see `SCREEN_OPERATIONS` in `src/middleware.ts`), and form
actions answer "This feature isn't connected yet".

`refreshSession` stays unmapped on purpose (no refresh tokens).

## ERP side

The ERP needs `PORTAL_URL` (the portal's base URL) so invitation and reset
emails link to `<PORTAL_URL>/reset-password`.

## Public website (`apps/web`)

```bash
ERP_API_BASE_URL=https://<erp-host>
ERP_API_TOKEN=<website API key from the ERP>
ERP_RESPONSE_ENVELOPE=data
ERP_RFQ_PATH=/public/v1/rfq
```
