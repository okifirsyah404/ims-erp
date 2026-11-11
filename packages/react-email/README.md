# @ims-erp/react-email

Email templates for IMS ERP, built with [React Email](https://react.email).

## Templates

| Component | Used for | Backend renderer |
|---|---|---|
| `VerificationEmail` | Account email verification (Better Auth) | `renderVerificationEmail` |
| `ResetPasswordEmail` | Password reset (Better Auth) | `renderResetPasswordEmail` |
| `InvitationEmail` | Organization-member invitation | `renderInvitationEmail` |

## Design decisions

- **Source-first package** — consumed directly as TSX (`exports: ".": "./src/index.ts"`), no build step. Bun and `bun build --compile` bundle it natively.
- **Theme from shadcn** — `src/theme.ts` mirrors the tokens of `packages/ui/src/styles/globals.css` (style `base-nova`, stone base, light only), pre-converted oklch → hex because email clients cannot resolve CSS variables/oklch. Tailwind via `pixelBasedPreset` (no rem).
- **i18n lives in the backend** — components receive final translated strings via props; the preview server works without translation resources.
- **HTML + plain text in one call** — `renderEmail()` wraps `@react-email/render`'s `render()` and returns `{ html, text }`.
- **Text only** — no images; add static assets + production CDN URL when needed.

## Development

```sh
bun run --filter '@ims-erp/react-email' dev   # preview server → http://localhost:3000
bun run --filter '@ims-erp/react-email' test  # render tests
```

Templates expose `.PreviewProps` with English sample copy for the preview UI.

## Adding a template

1. Create `emails/<name>-email.tsx` using `EmailLayout`, `ActionButton`, `FallbackLink`.
2. Export it from `src/index.ts` and add a test in `test/emails.test.tsx`.
3. Add i18n keys to `packages/locales/src/{en,id}/email.ts` and a renderer in `apps/backend/src/providers/mailer/mailer.templates.tsx`.

## Email-client constraints honored

- `box-border` on buttons, explicit `border-solid` on dividers
- No flex/grid, media queries, dark-mode selectors, SVG/WEBP
- Webfont (Nunito Sans) falls back to a system stack outside Apple Mail/iOS
