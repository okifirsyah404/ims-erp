# Sections — tsyringe skill

Rule categories, ordered by impact.

## 1. Registration — CRITICAL

How providers enter the container. Violations here make the dependency graph
unreviewable and produce hard-to-trace runtime errors.

- 1.1 Register at One Composition Root
- 1.2 Tokens Are Module-Scoped Symbols

## 2. Metadata & Lifetimes — HIGH

What the container needs to construct classes, and how long instances live.

- 2.1 Import reflect-metadata on Node Runtimes
- 2.2 Default to Transient via @injectable()

## 3. Resolution — MEDIUM-HIGH

Where instances are requested, and how to break construction cycles.

- 3.1 Resolve Only at the HTTP Boundary
- 3.2 Restructure Cycles Before Using delay()
