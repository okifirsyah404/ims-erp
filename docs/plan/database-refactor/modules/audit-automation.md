# audit + automation - ERP-0087

Schemas `audit`, `automation` · folders `src/app/audit`, `src/app/automation` ·
URLs `/audit`, `/automation` · phase P7

## audit

`audit.audit_logs` unchanged. Only the `action` / `target_type` vocabulary
constants are re-pointed where they name removed modules. Repository `audit`
(one table). Controller paths unchanged.

## automation

Built tables unchanged: `outbox_messages`, `faq_entries`,
`whatsapp_conversations`, `whatsapp_messages`. Changes:

- `whatsapp_conversations.lead_id` note -> `project.leads.id`; "convert chat
  to lead" calls `LeadService` (project).
- Outbox `aggregate_type` values re-pointed (`crm.lead` -> `project.lead`,
  `aftersales.service_ticket` -> `ticket.ticket`, etc.). Topics stay the same
  so the n8n workflow keeps working.
- Remove target-only tables from dbml: integrations, integration_credentials,
  workflows, workflow_steps, workflow_runs, workflow_step_runs,
  scheduled_jobs, job_executions.
- WhatsApp inbound leaves `whatsapp-webhook.controller.ts`: automation
  publishes `ExportedWhatsappWebhookService.handle(provider, headers, rawBody)`
  and the `webhook` module owns `/webhooks/whatsapp` plus the
  `/integrations/whatsapp` alias (Q38, `webhook.md`). Repositories already one per table (faq, outbox, whatsapp: split
  whatsapp into conversation + message).

Consumers: web-admin `automation-api.ts`, `whatsapp-api.ts` paths.

## Exit

Outbox delivery and WhatsApp webhook (old + new URL) tests green.
