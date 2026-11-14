---
title: Authentication
---

## Customer portal (`/portal/v1`)

1. **Sign in** — `POST /portal/v1/auth/login` with `{ email, password }`. The
   answer carries `tokens.accessToken` and `tokens.expiresAt`.
2. **Call** — send `Authorization: Bearer <accessToken>` on every other
   `/portal/v1` route. The token works **only** on `/portal/v1`.
3. **Expiry** — sessions last 7 days. There is **no refresh token**: when
   `expiresAt` passes (or a call answers `401`), sign the user in again.
4. **Sign out** — `POST /portal/v1/auth/logout`.

Failed sign-ins are counted per email: after **5** the email is locked for
**15 minutes** (`423`). A staff login, an unknown email and a wrong password
all answer the same `401`.

### Getting an account

| Who | How |
| --- | --- |
| Individual | `POST /portal/v1/auth/register` (`accountType: "individual"`) → a 6-digit code by email (10 minutes, 5 attempts) → `POST /portal/v1/auth/verify-email` signs them in. |
| Business | ERP staff invite a person (customer page → *Customer portal*). The email links to `<PORTAL_URL>/reset-password?token=…` (3 days); the portal sends the token to `POST /portal/v1/auth/password-reset/confirm`. |
| Colleague | An owner calls `POST /portal/v1/account/members`; same email as a staff invitation. |

`POST /portal/v1/auth/password-reset` sends a reset link (1 hour) to the
same page.

## Public website (`/public/v1`)

`Authorization: Bearer <ERP_API_TOKEN>` — an ERP API key issued for the
website. It stays on the website's server; a missing or wrong key answers
`401`.
