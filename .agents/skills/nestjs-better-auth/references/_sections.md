# Setup & Registration

Section prefix: `setup-`

Category impact: CRITICAL

Rules:

1. Disable Nest's body parser and let AuthModule own body parsing
2. Know every AuthModule.forRoot option

# Route Protection

Section prefix: `route-`

Category impact: CRITICAL

Rules:

1. Global AuthGuard by default — @AllowAnonymous to expose, @OptionalAuth for guests
2. Attach AuthGuard explicitly to WebSocket gateways

# Session & Auth API

Section prefix: `session-`

Category impact: HIGH

Rules:

1. Use @Session() and AuthService generics instead of ad-hoc request hacks

# Authorization

Section prefix: `authz-`

Category impact: HIGH

Rules:

1. Never mix @Roles() and @OrgRoles() — they check different fields by design
2. Pick the right permission decorator — user vs organization member

# Hooks

Section prefix: `hooks-`

Category impact: MEDIUM-HIGH

Rules:

1. Use @Hook classes for Better Auth hooks with NestJS dependency injection
2. Use @DatabaseHook classes for database lifecycle hooks

# CORS

Section prefix: `cors-`

Category impact: MEDIUM

Rules:

1. Let the module manage Better Auth route CORS — mind the Fastify fallback
