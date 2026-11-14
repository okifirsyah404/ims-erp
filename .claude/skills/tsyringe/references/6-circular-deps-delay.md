# 3.2 Restructure Cycles Before Using delay()

**Impact: MEDIUM**

## The Rule

tsyringe cannot construct cyclic constructor graphs — one side always sees
an undefined constructor. When a cycle appears, first extract a third
service or an interface/contract to cut it. `delay(() => Class)` is a last
resort, used with `@inject`:

```typescript
@injectable()
export class Foo {
  constructor(@inject(delay(() => Bar)) public bar: Bar) {}
}

@injectable()
export class Bar {
  constructor(@inject(delay(() => Foo)) public foo: Foo) {}
}

const foo = container.resolve(Foo);
// foo.bar is a proxy forwarding to the real Bar on first use
```

## Why Restructure First

- A constructor cycle is a design smell: two services mutually
  co-dependent usually contain one responsibility split across both.
  Extracting the shared logic (or depending on a contract both implement)
  removes the cycle permanently.
- `delay()` replaces the dependency with a proxy — first-use surprises
  (errors surface later than construction), harder-to-mock tests, and an
  invisible coupling that plain reading of the constructor no longer shows.

## Acceptable Use

- Two classes genuinely need each other's identity (e.g. mutual event
  notification) and extraction was attempted.
- Wrap it: `@inject(delay(() => OtherService))`, and note the cycle in a
  comment naming the extracted-service path.

## Diagnostic

The error names the position and class:

```
Error: Cannot inject the dependency at position #0 of "Foo" constructor. Reason:
    Attempted to construct an undefined constructor. Could mean a circular
    dependency problem. Try using `delay` function.
```

Treat "Try using `delay` function" as the library being polite — the skill
rule is: extract first, delay only with justification.

## Anti-patterns

- Reaching for `delay()` as the first fix.
- `delay()` on a non-cyclic dependency (it is only a cycle tool; for
  interface aliases use token providers per rule 1.2).
