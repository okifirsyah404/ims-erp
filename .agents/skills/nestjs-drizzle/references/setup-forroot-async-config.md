---
title: Configure asynchronously with forRootAsync
impact: CRITICAL
impactDescription: keeps secrets out of code and enables config-driven environments
tags: setup, forRootAsync, config, factory
---

## Configure asynchronously with forRootAsync

Hardcoding or reading `process.env` directly at module definition time breaks 12-factor config management and bypasses validation (e.g., `ConfigService.getOrThrow`). Use `DrizzleModule.forRootAsync()` when options come from `ConfigService` or another provider. Three styles: `useFactory` (inline), `useClass` (a `DrizzleOptionsFactory` implementation instantiated inside the module), and `useExisting` (reuse an exported provider from an imported module).

**Incorrect (what's wrong):**

```typescript
DrizzleModule.forRoot({
  drizzle,
  connection: process.env.DATABASE_URL!, // no validation, no async config
});
```

**Correct (what's right):**

```typescript
// useFactory — inline
DrizzleModule.forRootAsync({
  drizzle,
  useFactory: (configService: ConfigService) => ({
    connection: configService.getOrThrow<string>('DATABASE_URL'),
    relations,
  }),
  inject: [ConfigService],
});
```

```typescript
// useClass — dedicated config class implementing DrizzleOptionsFactory
@Injectable()
class DrizzleConfigService implements DrizzleOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createDrizzleOptions(): DrizzleModuleFactoryOptions {
    return {
      drizzle,
      connection: this.configService.getOrThrow<string>('DATABASE_URL'),
      relations,
    };
  }
}

DrizzleModule.forRootAsync({ useClass: DrizzleConfigService });
```

```typescript
// useExisting — reuse an instance exported by an imported module
DrizzleModule.forRootAsync({
  imports: [DatabaseConfigModule],
  useExisting: DrizzleConfigService,
});
```

**When NOT to use this pattern:**
- `useExisting` differs from `useClass`: it reuses the instance exported by the imported module instead of creating a new one — prefer it when the config class has its own dependencies you want shared.
- `createDrizzleOptions()` receives the name of the database being registered (`undefined` for the default one), so one class can configure several databases.

Reference: [NestJS Drizzle — forRootAsync](https://docs.nestjs.com/data/drizzle)
