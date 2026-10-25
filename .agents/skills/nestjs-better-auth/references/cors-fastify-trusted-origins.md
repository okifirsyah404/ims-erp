---
title: Let the module manage Better Auth route CORS — mind the Fastify fallback
impact: MEDIUM
impactDescription: prevents failed credentialed cross-origin auth requests
tags: cors, trustedOrigins, fastify
---

## Let the module manage Better Auth route CORS — mind the Fastify fallback

`@thallesp/nestjs-better-auth` automatically enables CORS on Better Auth routes based on `trustedOrigins` from your Better Auth config — you don't need a separate CORS setup just for auth endpoints. However, **function-based** `trustedOrigins` (returning origins at runtime) cannot be resolved on Fastify, where the module falls back to a static array approach — credentialed requests from your frontend will be rejected. Either use a static array, or set `disableTrustedOriginsCors: true` and manage CORS yourself.

**Incorrect (what's wrong):**

```typescript
// auth.ts — function-based origins + Fastify + module CORS enabled
export const auth = betterAuth({
  trustedOrigins: (request) => {
    const origin = request.headers.get('origin');
    return [origin ?? 'http://localhost:3000'];
  },
});
// Fastify: module can't resolve the function -> wrong CORS headers -> browser blocks requests
```

**Correct (what's right):**

```typescript
// Option 1: static array (works everywhere)
export const auth = betterAuth({
  trustedOrigins: ['https://app.example.com', 'http://localhost:3000'],
});

// Option 2: custom origins on Fastify — take over CORS yourself
AuthModule.forRoot({ auth, disableTrustedOriginsCors: true });
// then configure @fastify/cors or Nest's enableCors for the auth routes
```

**When NOT to use this pattern:**
- On Express, function-based `trustedOrigins` with module-managed CORS works as expected — only the Fastify fallback is limited.

Reference: [nestjs-better-auth — Trusted Origins CORS](https://github.com/ThallesP/nestjs-better-auth#trusted-origins-cors)
