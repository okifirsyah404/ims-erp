# Elysia Layered Architecture

**Version 1.3.0**
OpenAgentic
October 2026

> **Note:**
> This document is mainly for agents and LLMs to follow when maintaining,
> generating, or refactoring codebases. Humans may also find it useful,
> but guidance here is optimized for automation and consistency by AI-assisted workflows.

---

## Abstract

Layered backend architecture for Elysia domains in `apps/backend/src/app/<domain>/`.
Each domain is split into `contracts/` (zod schemas, interfaces, ports for
external systems), `constants/di.ts` (DI tokens), `controllers/` (HTTP-only
routes), `services/` (orchestration, including gateway implementations for
outside systems such as Better Auth's `auth.api`), `repositories/`
(Drizzle queries + cache), and optional `queues/` (module-owned BullMQ
jobs). Controllers parse with zod at the boundary and build the
`TApiResponse`/`TApiPaginatedResponse` envelope from `@ims-erp/common`;
services orchestrate repositories and ports without HTTP or SQL;
repositories implement contract interfaces and own soft-delete filtering
and Redis cache-aside. DI tokens live in a standalone `constants/di.ts`
module to prevent service↔container circular imports. Route conventions:
literal segments (`/me`) precede `/:id` params; identity for self routes
comes from the guard session. Contains 6 rules across 3 categories,
prioritized by impact from critical (controller scope, contracts-first
structure) to incremental (envelope placement, boundary parsing).

---

## Table of Contents

1. [Layer Boundaries](references/_sections.md#1-layer-boundaries) — **CRITICAL**
   - 1.1 [Controllers Own HTTP Only](references/1-controllers-http-only.md) — CRITICAL (Business logic in controllers cannot be reused by other transports and makes routes unreviewable)
   - 1.4 [Contracts in contracts/, DI Tokens in constants/di.ts](references/4-contracts-and-tokens.md) — CRITICAL (Inline tokens create a service↔container import cycle that crashes at module init)
2. [Service & Repository Scope](references/_sections.md#2-service--repository-scope) — **HIGH**
   - 1.2 [Services Orchestrate, Never Touch HTTP or Drizzle](references/2-services-orchestrate.md) — HIGH (SQL or envelope concerns in services duplicate repository behavior and break test seams)
   - 1.3 [Repositories Own Queries and Caching](references/3-repositories-own-queries.md) — HIGH (Scattered queries and cache writes produce stale reads and untestable services)
3. [Data Contracts](references/_sections.md#3-data-contracts) — **MEDIUM-HIGH**
   - 1.5 [Response Envelope at the HTTP Layer Only](references/5-envelope-at-http-layer.md) — MEDIUM-HIGH (requestId/status are transport concerns; envelope built deeper needs re-wrapping everywhere)
   - 1.6 [Zod Parse at the Boundary](references/6-zod-parse-at-boundary.md) — MEDIUM (Coercion must happen exactly once before typed code sees the value)

---

## References

1. [https://elysiajs.com](https://elysiajs.com)
2. [https://zod.dev](https://zod.dev)
3. `packages/common/src/contracts/api-response.ts` — the envelope types

---

## Source Files

This document was compiled from individual reference files. For detailed editing or extension:

| File | Description |
|------|-------------|
| [references/_sections.md](references/_sections.md) | Category definitions and impact ordering |
| [assets/templates/_template.md](assets/templates/_template.md) | Template for creating new rules |
| [SKILL.md](SKILL.md) | Quick reference entry point |
| [metadata.json](metadata.json) | Version, dependencies, and reference URLs |
