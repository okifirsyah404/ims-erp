# Elysia × tsyringe Wiring

**Version 1.1.0**
OpenAgentic
October 2026

> **Note:**
> This document is mainly for agents and LLMs to follow when maintaining,
> generating, or refactoring codebases. Humans may also find it useful,
> but guidance here is optimized for automation and consistency by AI-assisted workflows.

---

## Abstract

Wiring convention between Elysia plugins and the tsyringe container in
`apps/backend`. Domain controllers expose static `plugin()` factories that
resolve their service once via `container.resolve(TOKEN)` at plugin build
time; each module's `index.ts` groups its controllers behind a
`<module>Module()` factory returning one Elysia instance, each domain's
`container.ts` exports a `register<Domain>(container)`
function called from `src/index.ts` after provider registration, while
`src/app/app.ts` mounts the module factories inside a `createApp()` factory
(one `.use(<module>Module())` per module, never individual controllers) —
registration and mounting live in separate files; DI tokens
live in `constants/di.ts` to avoid service↔container circular
imports; `reflect-metadata` is imported first-line at the entrypoint,
required on Bun too because tsyringe's CJS entry checks
`Reflect.getMetadata` at load; each plugin enforces one path-param name per
position and uses `.onError({ as: 'local' })` to map validation failures to
the standard response envelope. Contains 7 rules across 3 categories,
prioritized by impact from critical (plugin factories, resolution placement,
registration order) to incremental (path-param constraints, error mapping).

---

## Table of Contents

1. [Wiring](references/_sections.md#1-wiring) — **CRITICAL**
   - 2.1 [Expose Controllers as Static plugin() Factories](references/1-plugin-factories.md) — CRITICAL (Top-level instances resolve at import time; unnamed plugins duplicate hooks on reload; app.ts mounts module factories, not controllers)
   - 2.2 [Resolve Only Inside plugin()](references/2-resolve-inside-plugin.md) — CRITICAL (Per-route or hand-built graphs defeat DI and fail late, per-request)
   - 2.3 [Domain container.ts Exports register<X>(container)](references/3-domain-registration.md) — CRITICAL (Registration order decides whether repositories get their connections; index.ts registers, app/app.ts mounts)
2. [Module Structure](references/_sections.md#2-module-structure) — **HIGH**
   - 2.4 [Tokens Live in constants/di.ts](references/4-token-modules.md) — HIGH (Tokens in container.ts create an import cycle that crashes at module init)
   - 2.5 [Import reflect-metadata at the Entrypoint](references/5-reflect-metadata.md) — HIGH (tsyringe throws at load without Reflect.getMetadata on every runtime, Bun included)
3. [Route & Error Mechanics](references/_sections.md#3-route--error-mechanics) — **MEDIUM**
   - 2.6 [One Path-Param Name per Position](references/6-path-param-names.md) — MEDIUM (memoirist rejects conflicting param names; routes fail at boot)
   - 2.7 [Plugin-Local onError Maps Validation to the Envelope](references/7-plugin-local-onerror.md) — MEDIUM (Unmapped Zod failures become 500s; helper names shadow context params)

---

## References

1. [https://elysiajs.com](https://elysiajs.com)
2. [https://github.com/microsoft/tsyringe#readme](https://github.com/microsoft/tsyringe#readme)
3. [https://www.npmjs.com/package/reflect-metadata](https://www.npmjs.com/package/reflect-metadata)

---

## Source Files

This document was compiled from individual reference files. For detailed editing or extension:

| File | Description |
|------|-------------|
| [references/_sections.md](references/_sections.md) | Category definitions and impact ordering |
| [assets/templates/_template.md](assets/templates/_template.md) | Template for creating new rules |
| [SKILL.md](SKILL.md) | Quick reference entry point |
| [metadata.json](metadata.json) | Version, dependencies, and reference URLs |
