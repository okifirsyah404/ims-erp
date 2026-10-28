# TSyringe

**Version 1.0.0**
OpenAgentic
October 2026

> **Note:**
> This document is mainly for agents and LLMs to follow when maintaining,
> generating, or refactoring codebases. Humans may also find it useful,
> but guidance here is optimized for automation and consistency by AI-assisted workflows.

---

## Abstract

Dependency-injection convention for this project using tsyringe (^4.10.0) in
`apps/backend-elysia`. Tokens are module-scoped `Symbol()`s exported next to
their registration; all `container.register` calls live in dedicated
container modules (one composition root per provider — today only
`drizzle/container.ts`); classes are `@injectable()` with constructor
`@inject(TOKEN)` parameters; routes resolve services via
`container.resolve(XService)` and never `new` them; lifetimes default
transient (`@injectable()`), with `@singleton()` reserved for stateful
process-wide instances and scoped lifetimes avoided until per-request state
is proven necessary. `@inject()` relies on `design:paramtypes` metadata:
Bun provides this without a polyfill today, but any Node runtime must
`import "reflect-metadata"` once at the entrypoint. Contains 6 rules across
3 categories, prioritized by impact from critical (composition root, token
conventions) to incremental (resolution placement, circular dependencies).

---

## Table of Contents

1. [Registration](references/_sections.md#1-registration) — **CRITICAL**
   - 1.1 [Register at One Composition Root](references/1-register-once.md) — CRITICAL (Scattered `container.register` calls make the object graph un-auditable; one container module per provider keeps registration reviewable)
   - 1.2 [Tokens Are Module-Scoped Symbols](references/2-token-conventions.md) — CRITICAL (String tokens collide silently and gain no type checking; Symbol tokens exported beside their registration are collision-free and greppable)
2. [Metadata & Lifetimes](references/_sections.md#2-metadata--lifetimes) — **HIGH**
   - 2.1 [Import reflect-metadata on Node Runtimes](references/3-reflect-metadata-polyfill.md) — HIGH (Bun supplies design:paramtypes natively, so the polyfill looks unnecessary — until the app runs under Node and every injection silently becomes undefined)
   - 2.2 [Default to Transient via @injectable()](references/4-injectable-vs-singleton.md) — HIGH (Premature singletons share mutable state across requests; scoped lifetimes add container complexity that per-request caches rarely justify)
3. [Resolution](references/_sections.md#3-resolution) — **MEDIUM-HIGH**
   - 3.1 [Resolve Only at the HTTP Boundary](references/5-scoped-lifetimes.md) — MEDIUM-HIGH (`new Service()` in a route bypasses nested injection; container.resolve inside a repository hides its true dependencies)
   - 3.2 [Restructure Cycles Before Using delay()](references/6-circular-deps-delay.md) — MEDIUM (delay() papers over design coupling; an extracted contract removes the cycle entirely)

---

## References

1. [https://github.com/microsoft/tsyringe#readme](https://github.com/microsoft/tsyringe#readme)
2. [https://www.npmjs.com/package/tsyringe](https://www.npmjs.com/package/tsyringe)
3. [https://www.npmjs.com/package/reflect-metadata](https://www.npmjs.com/package/reflect-metadata)

---

## Source Files

This document was compiled from individual reference files. For detailed editing or extension:

| File | Description |
|------|-------------|
| [references/_sections.md](references/_sections.md) | Category definitions and impact ordering |
| [assets/templates/_template.md](assets/templates/_template.md) | Template for creating new rules |
| [SKILL.md](SKILL.md) | Quick reference entry point (includes the composition-root source inline) |
| [metadata.json](metadata.json) | Version, dependencies, and reference URLs |
