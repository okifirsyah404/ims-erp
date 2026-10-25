---
title: Disable Nest's body parser and let AuthModule own body parsing
impact: CRITICAL
impactDescription: prevents auth requests from failing or losing raw request data
tags: setup, body-parser, rawBody, bootstrap
---

## Disable Nest's body parser and let AuthModule own body parsing

Better Auth must receive the request body exactly as the client sent it. Nest's global body parsers (`json`, `urlencoded`) would consume the stream first and alter it, so they must be disabled. `AuthModule.forRoot()` then re-adds its own parsers **after** Nest's, including (optionally) the raw body (`req.rawBody`) that Better Auth expects. Forgetting either half breaks every auth route (sign-in/sign-up returning 400/413, webhook signature failures).

**Incorrect (what's wrong):**

```typescript
// main.ts — Nest still parses bodies before Better Auth sees them
async function bootstrap() {
  const app = await NestFactory.create(AppModule); // bodyParser: true (default)
  await app.listen(3000);
}

// Or only disabling without replacements:
NestFactory.create(AppModule, { bodyParser: false }); // auth routes get empty req.body
```

**Correct (what's right):**

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  await app.listen(3000);
}
```

```typescript
// app.module.ts
AuthModule.forRoot({
  auth,
  bodyParser: {
    json: { enabled: true, limit: '5mb' },
    urlencoded: { enabled: true, extended: true },
    rawBody: true, // enables req.rawBody for signature verification
  },
}),
```

**When NOT to use this pattern:**
- Fastify users additionally need the `qs` query-string parser for urlencoded parsing; it is a peer dependency, install it explicitly.
- If you already disable body parsing globally for your own raw-body needs, only the `bodyParser` re-configuration is needed.

Reference: [nestjs-better-auth — Setup](https://github.com/ThallesP/nestjs-better-auth#setup)
