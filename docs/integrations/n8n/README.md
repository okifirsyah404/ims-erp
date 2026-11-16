# n8n workflow for ERP events (M04)

- `erp-event-router.workflow.json` — import this into n8n (≥ 2.x).
- `src/*.js` — the Code node sources; `build-workflow.ts` rebuilds the JSON from them.
- `send-test-event.ts` — sends signed sample events, the same way the ERP outbox does.

Guide: [`docs/user-guide/n8n-workflows.id.md`](../../user-guide/n8n-workflows.id.md)
([English](../../user-guide/n8n-workflows.en.md)). Event fields:
`docs/architecture/modules/automation.md`, "The event contract".
