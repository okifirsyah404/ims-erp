# Architecture & Technical Documentation

Technical, evidence-based documentation for the IMS/Entragate ERP. Planning and
status live in `docs/plan/`; agent skills inventory in `.agents/docs/skills.md`.

## First session / resume reading order

1. `../AGENTS.md` (repo root) — hard rules and definition of done
2. `project-audit.md` — what exists, what works, known failures
3. `stack-compatibility.md` — exact resolved versions and risks
4. `../plan/progress.md` — latest state; start where the doc says work stopped
5. `architecture.md` — module boundaries and DI rules
6. `domain-map.md` — business capability ownership and scope boundaries

## Reference by need

| File | Read when |
|---|---|
| `data-model.md` | adding/changing tables, keys, money, or dates |
| `api-conventions.md` | adding/changing endpoints |
| `security-and-access.md` | touching auth, permissions, portals, audit |
| `testing-strategy.md` | writing tests |
| `runbook.md` | running/verifying commands, environment variables |
| `modules/` | per-technical-module boundaries, state, data ownership, tests |
| `decisions/` | architectural decision records (ADRs) |

Database schema documentation lives in `docs/database/` (sibling folder):
`docs.dbml` (canonical persistence contract), 5 companion MDs
(`module-ownership`, `integrity-and-consistency`, `data-dictionary`,
`logical-references`, `implementation-phases`), and the
`gen-logical-references.ts` / `validate-dbml.ts` scripts.

End-user documentation (how to use the web admin, English and Indonesian,
with UML flow diagrams) lives in `docs/user-guide/`; update it in the same
change when a user-visible flow, label or status changes.

Any backend feature work reads that folder first and runs the `grill-me`
design interview; see **Feature module lifecycle** in `../AGENTS.md`.

## Decision records (ADR index)

| ADR | Title | Status |
|---|---|---|
| [ADR-0010](decisions/ADR-0010-department-orgs-warehouse-links.md) | Department Organizations and Warehouse Links | proposed |
| [ADR-0012](decisions/ADR-0012-multi-organization.md) | Multiple Organizations, Company-Wide Master Data | accepted (2026-11-08) |
| [ADR-0014](decisions/ADR-0014-nullable-cross-module-references.md) | Nullable Cross-Module References | accepted (2026-11-08) |
| [ADR-0015](decisions/ADR-0015-company-document-code-number-split.md) | Company / Document / Code Number Schema Split | accepted (2026-11-13) |
| [ADR-0016](decisions/ADR-0016-notification-module-and-single-realtime-socket.md) | Notification Module and the Single Realtime Socket | accepted (2026-11-13) |
| [ADR-0019](decisions/ADR-0019-squashed-per-schema-migration-baseline.md) | Squashed per-Schema Migration Baseline | accepted (2026-11-14) |
| [ADR-0020](decisions/ADR-0020-outbox-events-and-whatsapp.md) | ERP Events Through an Outbox to n8n; WhatsApp Through WAHA | proposed (2026-11-12; renumbered from ADR-0015 on the M04 merge) |
| [ADR-0021](decisions/ADR-0021-provider-neutral-payment-gateway.md) | Provider-Neutral Payment Gateway for Invoices | proposed (2026-11-14) |
