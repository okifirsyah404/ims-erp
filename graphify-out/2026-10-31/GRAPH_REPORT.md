# Graph Report - erp  (2026-10-31)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1971 nodes · 3620 edges · 134 communities (111 shown, 23 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8a1a24d4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- elysia-auth.ts
- menubar.tsx
- TVillageSelect
- TRegencySelect
- backend/package.json
- main-sidebar.tsx
- with
- with
- TDistrictSelect
- ui/src/components/sidebar.tsx
- location.controller.ts
- ui/package.json
- auth.options.ts
- combobox.tsx
- db.ts
- TPaginationResult
- web-admin/package.json
- environment
- quotation.repository.ts
- user.controller.ts
- UserRepository
- sales.schema.ts
- avatar.worker.ts
- @base-ui/react
- ProvinceRepository
- plugin.auth.ts
- class-variance-authority
- location.schema.ts
- sales.service.ts
- routeTree.gen.ts
- updates
- Button
- questionnaire.tsx
- compilerOptions
- tasks
- user.service.ts
- compilerOptions
- components.json
- cn
- command.tsx
- common/package.json
- package.json
- backend/src/index.ts
- with
- with
- compilerOptions
- location.seeder.ts
- devDependencies
- devDependencies
- login-form.tsx
- context-menu.tsx
- config.schema.ts
- UserService
- better-auth-user.gateway.ts
- IBaseRepository
- drawer.tsx
- scripts
- gen-logical-references.ts
- carousel.tsx
- theme-provider.tsx
- _authed.index.tsx
- @remixicon/react
- chart.tsx
- toast.tsx
- compilerOptions
- compilerOptions
- attachment.tsx
- SalesService
- auth-hooks.ts
- main.tsx
- color-pair.tsx
- redis
- ref_react
- code-block.tsx
- field.tsx
- highlighter.tsx
- compilerOptions
- devDependencies
- sales.controller.ts
- build
- lint
- docker
- steps
- lint
- docker
- steps
- navigation-menu.tsx
- select.tsx
- ../../tsconfig.json
- backend
- postgres
- validate-dbml.ts
- scripts
- pagination.tsx
- mock-db.ts
- web-admin/tsconfig.json
- showcase-coverage.mjs
- empty.tsx
- typescript
- web-admin/.oxlintrc.json
- scripts
- input-otp.tsx
- bubble.tsx
- config.loader.ts
- interface
- healthcheck
- on
- on
- ui/.oxlintrc.json
- resizable.tsx
- alert.tsx
- progress.tsx
- changes
- test
- changes
- test
- exports
- web-admin
- tsconfig.build.json
- scripts
- TSetUserRole
- { signIn, signOut, useSession, getSession, organization }

## God Nodes (most connected - your core abstractions)
1. `cn` - 65 edges
2. `@base-ui/react` - 40 edges
3. `Button()` - 35 edges
4. `TPaginationResult` - 31 edges
5. `environment` - 30 edges
6. `TVillageSelect` - 27 edges
7. `TRegencySelect` - 27 edges
8. `TDistrictSelect` - 27 edges
9. `@remixicon/react` - 26 edges
10. `VillageRepository` - 25 edges

## Surprising Connections (you probably didn't know these)
- `@types/bun@latest` --declares--> `@types/bun`  [EXTRACTED]
  packages/common/package.json → package.json
- `typescript@^6.0.3` --declares--> `typescript`  [EXTRACTED]
  apps/web-admin/package.json → package.json
- `typescript@~6.0.2` --declares--> `typescript`  [EXTRACTED]
  packages/ui/package.json → package.json
- `IDistrictRepository` --inherits--> `IBaseRepository`  [EXTRACTED]
  apps/backend/src/app/location/contracts/district.repository.interface.ts → packages/common/src/contracts/repository.ts
- `IProvinceRepository` --inherits--> `IBaseRepository`  [EXTRACTED]
  apps/backend/src/app/location/contracts/province.repository.interface.ts → packages/common/src/contracts/repository.ts

## Import Cycles
- None detected.

## Communities (134 total, 23 thin omitted)

### Community 0 - "elysia-auth.ts"
Cohesion: 0.06
Nodes (44): envelope(), ErpAuthError, ErpContext, erpGuard(), ErpMember, guardResolve(), ORGANIZATION_HEADER, parseRequirement() (+36 more)

### Community 1 - "menubar.tsx"
Cohesion: 0.10
Nodes (33): initials(), NavUser(), TeamSwitcher(), Avatar(), AvatarFallback(), AvatarImage(), DropdownMenu(), DropdownMenuContent() (+25 more)

### Community 2 - "TVillageSelect"
Cohesion: 0.09
Nodes (5): TVillageInsert, TVillageSelect, IVillageRepository, VillageRepository, LocationService

### Community 3 - "TRegencySelect"
Cohesion: 0.11
Nodes (4): TRegencyInsert, TRegencySelect, IRegencyRepository, RegencyRepository

### Community 4 - "backend/package.json"
Cohesion: 0.08
Nodes (34): dependencies, @better-auth/api-key@^1.7.14, @better-auth/drizzle-adapter@^1.7.14, @better-auth/passkey@^1.7.14, @bogeychan/elysia-logger@^0.1.10, bullmq@^6.5.1, @dicebear/converter@^10.7.0, @dicebear/core@^10.7.0 (+26 more)

### Community 5 - "main-sidebar.tsx"
Cohesion: 0.13
Nodes (25): AppSidebar(), data, NavMain(), NavProjects(), Collapsible(), CollapsibleContent(), CollapsibleTrigger(), SidebarContent() (+17 more)

### Community 6 - "with"
Cohesion: 0.06
Nodes (33): environment, if, name, permissions, runs-on, steps, env, HUSKY (+25 more)

### Community 7 - "with"
Cohesion: 0.06
Nodes (33): environment, if, name, permissions, runs-on, steps, env, HUSKY (+25 more)

### Community 8 - "TDistrictSelect"
Cohesion: 0.11
Nodes (3): TDistrictInsert, TDistrictSelect, DistrictRepository

### Community 9 - "ui/src/components/sidebar.tsx"
Cohesion: 0.11
Nodes (20): Input(), Sheet(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetPortal(), SheetTitle() (+12 more)

### Community 10 - "location.controller.ts"
Cohesion: 0.09
Nodes (24): apiErrorSchema, apiMetaSchema, districtQuerySchema, paginationQuerySchema, provinceQuerySchema, regencyQuerySchema, TDistrictQuery, TPaginationQuery (+16 more)

### Community 11 - "ui/package.json"
Cohesion: 0.09
Nodes (30): dependencies, @base-ui/react@^1.9.0, class-variance-authority@^0.7.1, cmdk@^1.1.1, cn@^0.5.0, date-fns@^4.4.0, embla-carousel-react@^8.6.0, @fontsource-variable/nunito-sans@^5.3.0 (+22 more)

### Community 12 - "auth.options.ts"
Cohesion: 0.11
Nodes (20): appConfig, accounts, apikeys, authSchema, invitations, members, organizations, passkeys (+12 more)

### Community 13 - "combobox.tsx"
Cohesion: 0.11
Nodes (13): ComboboxChip(), ComboboxClear(), ComboboxInput(), ComboboxTrigger(), CommandInput(), InputGroup(), InputGroupAddon(), inputGroupAddonVariants (+5 more)

### Community 14 - "db.ts"
Cohesion: 0.12
Nodes (22): logger, main(), resetSchemas(), SYSTEM_SCHEMAS, logger, main(), runSeeders(), logger (+14 more)

### Community 15 - "TPaginationResult"
Cohesion: 0.19
Nodes (15): DISTRICT_REPOSITORY_TOKEN, LOCATION_SERVICE_TOKEN, PROVINCE_REPOSITORY_TOKEN, REGENCY_REPOSITORY_TOKEN, VILLAGE_REPOSITORY_TOKEN, IDistrictRepository, TDistrictPaginationRequest, IProvinceRepository (+7 more)

### Community 16 - "web-admin/package.json"
Cohesion: 0.10
Nodes (26): better-auth@^1.7.14, @ims-erp/common@workspace:*, better-auth, @ims-erp/common, dependencies, better-auth@^1.7.12, @ims-erp/common@workspace:*, @ims-erp/ui@workspace:* (+18 more)

### Community 17 - "environment"
Cohesion: 0.08
Nodes (26): environment, APP_HOST, APP_ID, APP_LOG_LEVEL, APP_NAME, APP_PORT, APP_SECRET, APP_URL (+18 more)

### Community 18 - "quotation.repository.ts"
Cohesion: 0.13
Nodes (11): QUOTATION_STATUSES, quotations, TQuotationInsert, TQuotationSelect, TApproveQuotationInput, TCreateQuotationInput, TQuotationRepository, TSubmitQuotationInput (+3 more)

### Community 19 - "user.controller.ts"
Cohesion: 0.13
Nodes (19): banUserSchema, createUserSchema, paginationQuerySchema, setUserRoleSchema, TBanUser, TCreateUser, TPaginationQuery, TUserIdParams (+11 more)

### Community 20 - "UserRepository"
Cohesion: 0.16
Nodes (3): TUserInsert, TUserSelect, UserRepository

### Community 21 - "sales.schema.ts"
Cohesion: 0.14
Nodes (13): PAYMENT_STATUSES, payments, PaymentStatus, QuotationStatus, salesRelations, salesSchema, TPaymentInsert, TPaymentSelect (+5 more)

### Community 22 - "avatar.worker.ts"
Cohesion: 0.16
Nodes (17): AVATAR_QUEUE_NAME, AvatarJobData, avatarQueue, avatarUserCreateHook(), dispatchAvatarGeneration(), generateAvatarPng(), initialsStyle, processAvatarJob() (+9 more)

### Community 23 - "@base-ui/react"
Cohesion: 0.12
Nodes (12): ButtonGroup(), ButtonGroupSeparator(), buttonGroupVariants, FieldSeparator(), Item(), ItemMedia(), itemMediaVariants, ItemSeparator() (+4 more)

### Community 24 - "ProvinceRepository"
Cohesion: 0.18
Nodes (3): TProvinceInsert, TProvinceSelect, ProvinceRepository

### Community 25 - "plugin.auth.ts"
Cohesion: 0.19
Nodes (9): betterAuthLogger, betterAuthAdminPlugin, betterAuthApiKeyPlugin, betterAuthEmailOTPPlugin, betterAuthMagicLinkPlugin, betterAuthMultiSessionPlugin, betterAuthOpenAPIPlugin, betterAuthPasskeyPlugin (+1 more)

### Community 26 - "class-variance-authority"
Cohesion: 0.12
Nodes (11): Badge(), badgeVariants, Marker(), markerVariants, TabsList(), tabsListVariants, ToggleGroupContext, ToggleGroupItem() (+3 more)

### Community 27 - "location.schema.ts"
Cohesion: 0.30
Nodes (11): unixTimestamp, unixTimestampNullable, district, locationSchema, province, regency, village, DRIZZLE_TOKEN (+3 more)

### Community 28 - "sales.service.ts"
Cohesion: 0.19
Nodes (15): PAYMENT_REPOSITORY_TOKEN, QUOTATION_REPOSITORY_TOKEN, SALES_SERVICE_TOKEN, TQuotationActionContext, baseHeaders(), jsonRequest(), buildTestApp(), fixture (+7 more)

### Community 29 - "routeTree.gen.ts"
Cohesion: 0.13
Nodes (16): Route, Route, Route, Route, AuthedIndexRoute, AuthedRoute, AuthedRouteChildren, AuthedRouteWithChildren (+8 more)

### Community 30 - "updates"
Cohesion: 0.10
Nodes (20): update-types, update-types, update-types, actions, backend-minor-patch, common-minor-patch, ui-minor-patch, webadmin-minor-patch (+12 more)

### Community 31 - "Button"
Cohesion: 0.12
Nodes (7): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogOverlay(), AlertDialogPortal(), Button(), MessageScrollerButton()

### Community 32 - "questionnaire.tsx"
Cohesion: 0.13
Nodes (7): buttonVariants, Calendar(), CalendarDayButton(), QuestionnaireNext(), QuestionnairePrevious(), QuestionnaireSkip(), QuestionnaireSubmit()

### Community 33 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, allowJs, jsx, lib, module, moduleDetection, moduleResolution (+12 more)

### Community 34 - "tasks"
Cohesion: 0.10
Nodes (20): dependsOn, outputs, cache, persistent, dependsOn, dependsOn, $schema, cache (+12 more)

### Community 35 - "user.service.ts"
Cohesion: 0.22
Nodes (9): USER_AUTH_GATEWAY_TOKEN, USER_REPOSITORY_TOKEN, USER_SERVICE_TOKEN, IUserAuthGateway, TAuthGatewayCreateUser, IUserRepository, TUserPaginationRequest, TUserProfile (+1 more)

### Community 36 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, module, moduleResolution, paths (+11 more)

### Community 37 - "components.json"
Cohesion: 0.10
Nodes (19): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+11 more)

### Community 39 - "command.tsx"
Cohesion: 0.16
Nodes (9): CommandDialog(), Dialog(), DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogPortal() (+1 more)

### Community 40 - "common/package.json"
Cohesion: 0.12
Nodes (17): author, dependencies, zod@^4.6.7, description, files, zod, license, main (+9 more)

### Community 41 - "package.json"
Cohesion: 0.15
Nodes (16): drizzle-kit@^1.0.0-rc.5, @types/bun@^1.4.4, devDependencies, drizzle-kit@^1.0.0-rc.5, husky@^9.1.7, turbo@^2.10.13, @types/bun@^1.4.4, drizzle-kit (+8 more)

### Community 42 - "backend/src/index.ts"
Cohesion: 0.16
Nodes (11): elysiaApp, registerLocation(), registerSales(), registerUser(), registerProvider(), avatarWorker, bootstrap, auth (+3 more)

### Community 43 - "with"
Cohesion: 0.12
Nodes (17): with, artifact-name, bun-version, cache-from, cache-to, context, coverage-files, file (+9 more)

### Community 44 - "with"
Cohesion: 0.12
Nodes (17): with, artifact-name, bun-version, cache-from, cache-to, context, coverage-files, file (+9 more)

### Community 45 - "compilerOptions"
Cohesion: 0.12
Nodes (17): compilerOptions, allowImportingTsExtensions, declaration, declarationMap, esModuleInterop, incremental, isolatedModules, module (+9 more)

### Community 46 - "location.seeder.ts"
Cohesion: 0.27
Nodes (15): AnyLocationTable, drizzleName, insertChunked(), LocationEntry, LocationRow, logger, rawLocationPath(), readRawLocationData() (+7 more)

### Community 47 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, @tanstack/router-plugin@^1.130.0, tw-animate-css@^1.4.0, @types/react-dom@^19, typescript@^6.0.3, vite@^8.3.5, @vitejs/plugin-react@^6.1.2, tw-animate-css@^1.4.0 (+6 more)

### Community 48 - "devDependencies"
Cohesion: 0.12
Nodes (16): tailwindcss@^4, @tailwindcss/vite@^4, @types/node@^24.19.2, @types/react@^19, devDependencies, tailwindcss@^4, @tailwindcss/vite@^4, @turbo/gen@^2.11.7 (+8 more)

### Community 49 - "login-form.tsx"
Cohesion: 0.19
Nodes (7): LoginForm(), LoginPage(), loginSearchSchema, Card(), CardContent(), FieldGroup(), FieldLabel()

### Community 51 - "config.schema.ts"
Cohesion: 0.13
Nodes (14): AppConfigSchema, AuthConfigSchema, DatabaseConfigSchema, InstanceConfigSchema, RedisConfigSchema, S3ConfigSchema, SMTPConfigSchema, TAppConfig (+6 more)

### Community 52 - "UserService"
Cohesion: 0.21
Nodes (3): TUpdateUser, UserService, makeService()

### Community 53 - "better-auth-user.gateway.ts"
Cohesion: 0.23
Nodes (4): BetterAuthUserGateway, translate(), UserEmailTakenError, UserNotFoundError

### Community 55 - "drawer.tsx"
Cohesion: 0.17
Nodes (7): DrawerContent(), DrawerContext, DrawerContextProps, DrawerOverlay(), DrawerPortal(), DrawerSwipeHandle(), useDrawer()

### Community 56 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, auth:generate, dev, drizzle:generate, drizzle:migrate, drizzle:migrate-reset, drizzle:pull, drizzle:push (+6 more)

### Community 57 - "gen-logical-references.ts"
Cohesion: 0.14
Nodes (9): begin, byTarget, db, end, MODULE_LABELS, prev, refs, sortedTargets (+1 more)

### Community 58 - "carousel.tsx"
Cohesion: 0.19
Nodes (12): CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions, CarouselPlugin (+4 more)

### Community 59 - "theme-provider.tsx"
Cohesion: 0.21
Nodes (11): disableTransitionsTemporarily(), getSystemTheme(), isEditableTarget(), isTheme(), ResolvedTheme, Theme, THEME_VALUES, ThemeProvider() (+3 more)

### Community 60 - "_authed.index.tsx"
Cohesion: 0.35
Nodes (10): IndexPage(), Breadcrumb(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator(), SidebarInset() (+2 more)

### Community 62 - "chart.tsx"
Cohesion: 0.22
Nodes (12): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), ChartTooltipContent(), getPayloadConfigFromPayload() (+4 more)

### Community 63 - "toast.tsx"
Cohesion: 0.28
Nodes (12): toast, ToastAction(), ToastClose(), ToastContent(), ToastDescription(), Toaster(), ToastIcon(), ToastList() (+4 more)

### Community 64 - "compilerOptions"
Cohesion: 0.17
Nodes (12): compilerOptions, allowArbitraryExtensions, erasableSyntaxOnly, jsx, lib, noUnusedLocals, noUnusedParameters, paths (+4 more)

### Community 65 - "compilerOptions"
Cohesion: 0.17
Nodes (12): compilerOptions, erasableSyntaxOnly, lib, module, moduleResolution, noUnusedLocals, noUnusedParameters, paths (+4 more)

### Community 66 - "attachment.tsx"
Cohesion: 0.20
Nodes (5): Attachment(), AttachmentAction(), AttachmentMedia(), attachmentMediaVariants, attachmentVariants

### Community 68 - "auth-hooks.ts"
Cohesion: 0.25
Nodes (10): ADMIN_GRANTABLE_ROLES, AuthAdapterLike, betterAuthHooks(), containsOwner(), findActorMember(), forbidden(), HookContextLike, MemberRow (+2 more)

### Community 69 - "main.tsx"
Cohesion: 0.22
Nodes (7): @tanstack/react-query@^5.66.0, queryClient, Register, router, @tanstack/react-router, routeTree, @tanstack/react-query

### Community 70 - "color-pair.tsx"
Cohesion: 0.25
Nodes (6): ColorPair(), contrast(), luminance(), toHex(), toRgb(), defaultStates

### Community 71 - "redis"
Cohesion: 0.18
Nodes (10): name, command, image, restart, volumes, services, redis, volumes (+2 more)

### Community 72 - "ref_react"
Cohesion: 0.20
Nodes (3): ButtonProps, ScrollArea(), ScrollBar()

### Community 73 - "code-block.tsx"
Cohesion: 0.24
Nodes (6): CodeBlock(), CodeBlockContent(), CodeBlockCopyButton(), CodeBlockLine(), codeBlockLineVariants, codeBlockVariants

### Community 74 - "field.tsx"
Cohesion: 0.22
Nodes (3): Field(), fieldVariants, Label()

### Community 75 - "highlighter.tsx"
Cohesion: 0.29
Nodes (8): useHighlightedCode(), aliases, getHighlighter(), getLanguage(), highlightCode(), languages, loadHighlighter(), shiki

### Community 76 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, lib, paths, target, types, verbatimModuleSyntax, exclude, extends (+2 more)

### Community 77 - "devDependencies"
Cohesion: 0.20
Nodes (9): devDependencies, oxlint@^1.89.0, reflect-metadata@^0.2.2, @types/luxon@^3.7.6, oxlint@^1.89.0, oxlint@^1.89.0, oxlint, reflect-metadata (+1 more)

### Community 78 - "sales.controller.ts"
Cohesion: 0.24
Nodes (8): createPaymentSchema, createQuotationSchema, envelope(), errorEnvelope(), idParamSchema, listQuerySchema, SalesController, updateQuotationSchema

### Community 79 - "build"
Cohesion: 0.24
Nodes (9): build, image, context, dockerfile, services, backend, web-admin, build (+1 more)

### Community 80 - "lint"
Cohesion: 0.20
Nodes (9): env, HUSKY, jobs, lint, if, name, needs, runs-on (+1 more)

### Community 81 - "docker"
Cohesion: 0.22
Nodes (10): permissions, name, needs, permissions, runs-on, docker, checks, contents (+2 more)

### Community 82 - "steps"
Cohesion: 0.29
Nodes (10): steps, steps, steps, id, if, name, run, uses (+2 more)

### Community 83 - "lint"
Cohesion: 0.20
Nodes (9): env, HUSKY, jobs, lint, if, name, needs, runs-on (+1 more)

### Community 84 - "docker"
Cohesion: 0.22
Nodes (10): permissions, name, needs, permissions, runs-on, docker, checks, contents (+2 more)

### Community 85 - "steps"
Cohesion: 0.29
Nodes (10): steps, steps, steps, id, if, name, run, uses (+2 more)

### Community 86 - "navigation-menu.tsx"
Cohesion: 0.24
Nodes (4): NavigationMenu(), NavigationMenuPositioner(), NavigationMenuTrigger(), navigationMenuTriggerStyle

### Community 87 - "select.tsx"
Cohesion: 0.24
Nodes (3): SelectContent(), SelectScrollDownButton(), SelectScrollUpButton()

### Community 88 - "../../tsconfig.json"
Cohesion: 0.22
Nodes (6): extends, include, extends, include, extends, ../../tsconfig.json

### Community 89 - "backend"
Cohesion: 0.22
Nodes (9): depends_on, image, ports, restart, postgres, redis, condition, condition (+1 more)

### Community 90 - "postgres"
Cohesion: 0.22
Nodes (9): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, TZ, environment, image, restart, volumes (+1 more)

### Community 91 - "validate-dbml.ts"
Cohesion: 0.22
Nodes (6): AUTH_CORE, db, gaps, nameMap, tables, TIMESTAMP_EXEMPT

### Community 92 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, build:libs, dev, format, lint, prepare, test (+1 more)

### Community 93 - "pagination.tsx"
Cohesion: 0.28
Nodes (4): PaginationLink(), PaginationLinkProps, PaginationNext(), PaginationPrevious()

### Community 95 - "mock-db.ts"
Cohesion: 0.32
Nodes (6): CapturedQuery, ChainConfig, mockDb(), mockRedis(), Row, row

### Community 96 - "web-admin/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, paths, extends, files, @ims-erp/ui/*, @workspace/ui/*, references

### Community 97 - "showcase-coverage.mjs"
Cohesion: 0.25
Nodes (6): components, missing, source, [uiArg, ...roots], uiDir, walk()

### Community 99 - "typescript"
Cohesion: 0.29
Nodes (7): typescript@^6.0.3, typescript, peerDependencies, typescript@^6.0.3, devDependencies, @types/bun@latest, typescript@^6.0.3

### Community 100 - "web-admin/.oxlintrc.json"
Cohesion: 0.29
Nodes (6): overrides, plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 101 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, preview, test, test:cov

### Community 103 - "bubble.tsx"
Cohesion: 0.38
Nodes (4): Bubble(), BubbleReactions(), bubbleReactionsVariants, bubbleVariants

### Community 106 - "config.loader.ts"
Cohesion: 0.40
Nodes (4): findEnvPath(), loadEnvConfig(), EnvConfigSchema, TEnvConfig

### Community 107 - "interface"
Cohesion: 0.33
Nodes (5): interface, display_name, icon_large, icon_small, short_description

### Community 108 - "healthcheck"
Cohesion: 0.53
Nodes (6): interval, retries, test, timeout, healthcheck, healthcheck

### Community 109 - "on"
Cohesion: 0.33
Nodes (6): on, pull_request, push, branches, branches, paths

### Community 110 - "on"
Cohesion: 0.33
Nodes (6): on, pull_request, push, branches, branches, paths

### Community 111 - "ui/.oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 114 - "progress.tsx"
Cohesion: 0.47
Nodes (3): Progress(), ProgressIndicator(), ProgressTrack()

### Community 115 - "changes"
Cohesion: 0.40
Nodes (5): name, outputs, runs-on, changes, backend

### Community 116 - "test"
Cohesion: 0.40
Nodes (5): test, if, name, needs, runs-on

### Community 117 - "changes"
Cohesion: 0.40
Nodes (5): name, outputs, runs-on, changes, web-admin

### Community 118 - "test"
Cohesion: 0.40
Nodes (5): test, if, name, needs, runs-on

### Community 119 - "exports"
Cohesion: 0.40
Nodes (5): exports, ./components/*, ./globals.css, ./hooks/*, ./lib/*

### Community 120 - "web-admin"
Cohesion: 0.50
Nodes (4): web-admin, image, ports, restart

### Community 121 - "tsconfig.build.json"
Cohesion: 0.50
Nodes (3): exclude, extends, include

### Community 122 - "scripts"
Cohesion: 0.50
Nodes (4): scripts, format, lint, typecheck

## Knowledge Gaps
- **4 isolated node(s):** `ADR-0006`, `{ signIn, signOut, useSession, getSession, organization }`, `ADR-0006`, `ADR-0002`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 824 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn` connect `cn` to `menubar.tsx`, `main-sidebar.tsx`, `ui/src/components/sidebar.tsx`, `ui/package.json`, `combobox.tsx`, `@base-ui/react`, `class-variance-authority`, `Button`, `questionnaire.tsx`, `command.tsx`, `login-form.tsx`, `context-menu.tsx`, `drawer.tsx`, `carousel.tsx`, `_authed.index.tsx`, `@remixicon/react`, `chart.tsx`, `toast.tsx`, `attachment.tsx`, `ref_react`, `code-block.tsx`, `field.tsx`, `navigation-menu.tsx`, `select.tsx`, `pagination.tsx`, `table.tsx`, `empty.tsx`, `input-otp.tsx`, `bubble.tsx`, `message.tsx`, `popover.tsx`, `resizable.tsx`, `alert.tsx`, `progress.tsx`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **What connects `ADR-0006`, `{ signIn, signOut, useSession, getSession, organization }`, `ADR-0006` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `elysia-auth.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05576923076923077 - nodes in this community are weakly interconnected._
- **Why does `typescript` connect `typescript` to `backend/package.json`, `common/package.json`, `package.json`, `ui/package.json`, `devDependencies`, `web-admin/package.json`, `devDependencies`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Should `menubar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09990749306197964 - nodes in this community are weakly interconnected._
- **Why does `tsyringe` connect `location.schema.ts` to `user.service.ts`, `backend/package.json`, `location.controller.ts`, `backend/src/index.ts`, `sales.controller.ts`, `TPaginationResult`, `quotation.repository.ts`, `user.controller.ts`, `sales.schema.ts`, `avatar.worker.ts`, `better-auth-user.gateway.ts`, `sales.service.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `TVillageSelect` be split into smaller, more focused modules?**
  _Cohesion score 0.09390243902439024 - nodes in this community are weakly interconnected._