---
title: Attach AuthGuard explicitly to WebSocket gateways
impact: CRITICAL
impactDescription: prevents silently unprotected real-time endpoints
tags: route, websocket, gateway, graphql, guard
---

## Attach AuthGuard explicitly to WebSocket gateways

The global `AuthGuard` covers REST controllers and GraphQL resolvers, but WebSocket gateways bypass HTTP middleware — the guard is not applied automatically there. You must decorate the gateway (or each `@SubscribeMessage` handler) with `@UseGuards(AuthGuard)`; otherwise sockets connect unauthenticated. `@AllowAnonymous()`/`@OptionalAuth()` work the same way once the guard is applied.

**Incorrect (what's wrong):**

```typescript
@WebSocketGateway({ path: '/ws' })
export class ChatGateway {
  @SubscribeMessage('message')
  handleMessage(client: any, payload: any) {} // no auth check — anyone connects
}
```

**Correct (what's right):**

```typescript
import { AuthGuard } from '@thallesp/nestjs-better-auth';

@WebSocketGateway({ path: '/ws' })
@UseGuards(AuthGuard) // guards all messages in this gateway
export class ChatGateway {
  @SubscribeMessage('message')
  handleMessage(client: any, payload: any) {}

  @AllowAnonymous() // optional: expose specific messages
  @SubscribeMessage('ping')
  ping() {}
}
```

**When NOT to use this pattern:**
- GraphQL resolvers need no extra wiring — the global guard applies there automatically; only WebSocket gateways require explicit `@UseGuards`.

Reference: [nestjs-better-auth — Route protection](https://github.com/ThallesP/nestjs-better-auth#route-protection)
