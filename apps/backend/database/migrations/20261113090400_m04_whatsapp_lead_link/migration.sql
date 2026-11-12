-- M04 4d: WhatsApp chat → CRM lead link (ERP-0021 lead capture).
-- Hand-written (no snapshot): drizzle-kit generate/migrate are blocked on
-- main by the pre-existing branching snapshot chain (runbook.md). lead_id is
-- a nullable cross-module reference to crm.leads.id (ADR-0014).
ALTER TABLE "automation"."whatsapp_conversations" ADD COLUMN "lead_id" uuid;
