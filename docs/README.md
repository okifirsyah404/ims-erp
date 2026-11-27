# Documentation

Start here. **Current work:** [`adjustment/README.md`](adjustment/README.md)
(Indonesian step guide). Rules for AI agents: `../AGENTS.md`, "Source of truth".

| Folder | Content | Language | Read while working? |
|---|---|---|---|
| [`adjustment/`](adjustment/README.md) | **Current program**: validation and UAT (`1-validasi`, incl. bug reports), owner decisions (`2-keputusan`), designs, schema notes and flow diagrams (`3-rancangan`), change plans and page map (`4-rencana-kerja`), implementation rules, code maps with AI prompts and work UAT (`5-pengerjaan`) | Indonesian | **Yes** (target behaviour) |
| [`database/`](database/) | Persistence contract: `docs.dbml`, module ownership, integrity rules, logical references, validators | English | Yes, when a task touches the schema |
| [`plan/`](plan/) | Official ledgers: `progress.md` (log, next task), `backlog.md` (ERP IDs), `features.md` (feature status); `kontrak/` (contract v5.1 and per-module scope); `port-portal-onto-main.md` (portal port plan, used in B-38) | English / Indonesian (contract) | Ledgers: written in every code PR; contract: scope checks only |
| [`architecture/`](architecture/README.md) | Technical reference: runbook, API conventions, testing strategy, stack versions (kept current), ADRs (`decisions/`), generated `role-permission.md` and its generator, background pages | English | Runbook/API/testing/stack yes; the rest only when a task points to it |
| [`integrations/`](integrations/README.md) | n8n workflow and WhatsApp (WAHA, Meta) guides | English / Indonesian | Only for n8n/WhatsApp tasks |

Commands that use these paths:

```text
bun docs/database/gen-logical-references.ts
bun docs/database/validate-dbml.ts
bun docs/architecture/gen-role-permission.ts
bun docs/integrations/n8n/build-workflow.ts
```
