# n8n workflow for ERP events (M04)

- `erp-event-router.workflow.json` — import this into n8n (≥ 2.x).
- `src/*.js` — the Code node sources; `build-workflow.ts` rebuilds the JSON from them.
- `send-test-event.ts` (+ `samples.ts`) — sends signed sample events, the same way the ERP outbox does.
- `meta-templates.json` — the 20 WhatsApp templates for the Meta Cloud API provider;
  `create-meta-templates.ts` submits them (except `erp_penawaran_terkirim`, which has a PDF
  header and is made by hand: "Templates with a PDF" in the Meta guide), `check-meta-templates.ts` checks the compose node
  against them (must print `OK`).

Guides: [`n8n-workflows.id.md`](guide-workflows.id.md)
([English](guide-workflows.en.md)) and, for the official Meta Cloud API instead of
WAHA, [`whatsapp-business-meta.id.md`](../whatsapp/meta-cloud-api.id.md)
([English](../whatsapp/meta-cloud-api.en.md)). Event fields:
`apps/backend/src/app/automation/contracts/outbox.contract.ts` and the event builders in each publishing service.
