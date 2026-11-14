# Rule Template — elysia-tsyringe skill

Copy this file to `references/<n>-<slug>.md` and fill in.

```markdown
# <n.n> <Rule Title>

**Impact: <CRITICAL | HIGH | MEDIUM-HIGH | MEDIUM>**

## The Rule

<One or two sentences: what is required. Imperative.>

## Canonical Example (from this repo)

<Path to the file that follows the rule + the relevant snippet.>

## Why

<2-4 bullets: what breaks without the rule, tied to Elysia/tsyringe semantics.>

## Anti-patterns

- <Concrete violation + consequence>
```

Notes:

- Examples must compile conceptually against `elysia@1.4.x` +
  `tsyringe@^4.10.0` and match real files in `apps/backend` — a rule
  without a repo example is a proposal, mark it as such.
- One rule per file; the number prefix must match the AGENTS.md table.
- Update `references/_sections.md` and the AGENTS.md Table of Contents when
  adding a rule.
