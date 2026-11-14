# Sections — elysia-tsyringe skill

Rule categories, ordered by impact.

## 1. Wiring — CRITICAL

How the plugin, the container, and the composition root connect.
Violations produce resolution failures or boot crashes.

- 2.1 Expose Controllers as Static plugin() Factories
- 2.2 Resolve Only Inside plugin()
- 2.3 Domain container.ts Exports register<X>(container)

## 2. Module Structure — HIGH

Where the wiring pieces live and what the runtime needs.

- 2.4 Tokens Live in constants/di.ts
- 2.5 Import reflect-metadata at the Entrypoint

## 3. Route & Error Mechanics — MEDIUM

Elysia-specific constraints discovered by crash.

- 2.6 One Path-Param Name per Position
- 2.7 Plugin-Local onError Maps Validation to the Envelope
