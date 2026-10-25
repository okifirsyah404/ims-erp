---
title: Use @Session() and AuthService generics instead of ad-hoc request hacks
impact: HIGH
impactDescription: preserves type safety for sessions and plugin-specific API methods
tags: session, decorator, authservice, generics
---

## Use @Session() and AuthService generics instead of ad-hoc request hacks

`@Session()` gives the full typed session (`UserSession`), and the request object carries `req.session` / `req.user` (useful for observability tools like Sentry). For server-side calls to Better Auth endpoints (including plugin-added methods like `createApiKey`), inject `AuthService<typeof auth>` — the generic carries plugin type extensions; without it, plugin methods are invisible to TypeScript. Always forward request headers via `fromNodeHeaders()` so the API call acts as the current user.

**Incorrect (what's wrong):**

```typescript
// No generic -> no plugin API methods, no type safety
constructor(private authService: AuthService) {}

// Any-casting instead of using the decorator
const session = (req as any).session;

// Calling auth API without headers -> acts as anonymous, wrong user context
await this.authService.api.listUserAccounts({});
```

**Correct (what's right):**

```typescript
import { fromNodeHeaders } from 'better-auth/node';

@Controller('users')
export class UsersController {
  constructor(private authService: AuthService<typeof auth>) {}

  @Get('me')
  getProfile(@Session() session: UserSession) {
    return session;
  }

  @Get('accounts')
  async getAccounts(@Request() req: ExpressRequest) {
    return this.authService.api.listUserAccounts({
      headers: fromNodeHeaders(req.headers),
    });
  }

  @Post('api-keys')
  async createApiKey(@Request() req: ExpressRequest, @Body() body: unknown) {
    // plugin method — available only via AuthService<typeof auth>
    return this.authService.api.createApiKey({
      ...body,
      headers: fromNodeHeaders(req.headers),
    } as never);
  }
}
```

**When NOT to use this pattern:**
- `req.user` is a direct reference to the user object in the session — prefer it only for observability/serialization; authorization checks should use decorators, not manual inspection.

Reference: [nestjs-better-auth — AuthService](https://github.com/ThallesP/nestjs-better-auth#authservice)
