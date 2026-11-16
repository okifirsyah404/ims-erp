# n8n workflow for ERP events (M04)

- `erp-event-router.workflow.json` — import this into n8n (≥ 2.x).
- `src/*.js` — the Code node sources; `build-workflow.ts` rebuilds the JSON from them.
- `send-test-event.ts` (+ `samples.ts`) — sends signed sample events, the same way the ERP outbox does.
- `meta-templates.json` — the 15 WhatsApp templates for the Meta Cloud API provider;
  `create-meta-templates.ts` submits them, `check-meta-templates.ts` checks the compose node
  against them (must print `OK`).

Guides: [`n8n-workflows.id.md`](../../user-guide/n8n-workflows.id.md)
([English](../../user-guide/n8n-workflows.en.md)) and, for the official Meta Cloud API instead of
WAHA, [`whatsapp-business-meta.id.md`](../../user-guide/whatsapp-business-meta.id.md)
([English](../../user-guide/whatsapp-business-meta.en.md)). Event fields:
`docs/architecture/modules/automation.md`, "The event contract".
