---
title: License integration (own apps)
---

How one of the company's own applications (gym, e-ticketing, visitor
management, and the next ones) checks its license against the ERP. The
endpoints are in the [License API reference](/licensing-api).

## What the ERP does

1. **Register the application.** In the ERP: *Subscription → Applications*,
   key source **own application**, with a short code (`GYM`, `TIX`, `VMS`, …).
2. **Sell a contract.** A license contract for the customer, with a package,
   start and end date and the number of seats. It generates the **license key**
   `XXXXX-XXXXX-XXXXX-XXXXX`, which the customer types into the application.
3. **Issue the application's API key.** Go to *Subscription → API keys* and
   choose **New API key** for the application. The secret `elk_…` is shown
   **once**. Store it in the application's server configuration
   (e.g. `ERP_LICENSE_API_KEY`). One API key per application and environment
   is enough. Revoking a key stops it at once.
4. **Watch and act.** *Subscription → Activations* lists every validate,
   activate and deactivate call. On the contract, staff see the seats, can
   release one (a replaced PC), suspend, terminate or renew. Paying the renewal
   invoice in full activates the renewal by itself.

## What the application does

| When | Call | On success | Otherwise |
| --- | --- | --- | --- |
| Setup: the customer enters the key | `POST /projects/api/v1/licenses/activate` with `licenseKey`, a stable `instanceId`, a `deviceName` | store the key and `instanceId` | show the reason: `404` wrong key, `403` not usable (expired, suspended…), `409` all seats in use |
| Start-up, then every few hours | `POST /projects/api/v1/licenses/validate` with `licenseKey` + `instanceId` | `valid: true` → run; `warning: true` → show "renew before `graceEndsOn`" | `valid: false` → lock the licensed features and show `status`; `not_activated` → activate again |
| Uninstall / move to another device | `POST /projects/api/v1/licenses/deactivate` | the seat is free | `404`: nothing to release |

- **`instanceId`** must stay the same for one installation. Generate a UUID on
  first run and keep it, or use the server's name. A new id takes a new
  seat.
- **Offline.** The API needs the ERP to be reachable. Cache the last good
  answer with its time, and keep running while the ERP is unreachable, up to
  `graceEndsOn` or a limit you choose (e.g. 72 hours). Never trust a missing
  answer as `valid: false`.
- **Grace.** For 7 days after `endsOn` the status is `grace` and the key is
  still valid. Use them to remind the customer to renew.
- **Rate limit.** 120 calls per minute per API key. Validate on start and on a
  timer (hours, not seconds). A `429` means slow down and retry later.
- **Secrets.** Call from the application's backend. The `elk_` key must never
  reach a browser or a mobile app bundle.

## Example (TypeScript)

```ts
const ERP = process.env.ERP_URL!; // e.g. https://erp.entragate.co.id
const KEY = process.env.ERP_LICENSE_API_KEY!; // elk_…

async function license(path: 'validate' | 'activate' | 'deactivate', body: object) {
  const response = await fetch(`${ERP}/projects/api/v1/licenses/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'Accept-Language': 'id' },
    body: JSON.stringify(body),
  });
  const envelope = await response.json();
  if (!response.ok) throw new Error(envelope.errors?.[0]?.message ?? envelope.message);
  return envelope.data;
}

// At start-up and every 6 hours:
const result = await license('validate', { licenseKey, instanceId });
if (result.status === 'not_activated') await license('activate', { licenseKey, instanceId, deviceName: hostname() });
else if (!result.valid) lockLicensedFeatures(result.status);
else if (result.warning) showRenewalBanner(result.graceEndsOn);
```

## Example (curl)

```bash
curl -X POST "$ERP_URL/projects/api/v1/licenses/validate" \
  -H "Authorization: Bearer $ERP_LICENSE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"licenseKey":"ABCDE-FGHJK-LMNPQ-RS234","instanceId":"gym-jakarta-pc01"}'
```

## Not provided (yet)

Signed offline licence files, feature entitlements per package, and usage
metering are not part of the API. Ask the ERP team if an application needs
them.
