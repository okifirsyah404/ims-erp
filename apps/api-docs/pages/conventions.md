---
title: Conventions
---

## Envelope

Every answer is wrapped:

```json
{
  "requestId": "0b6c0c5e-…",
  "status": 200,
  "message": "OK",
  "timestamp": 1794661085259,
  "data": { "…": "…" }
}
```

Set `ERP_RESPONSE_ENVELOPE=data` in the website so the adapter unwraps `data`.
Errors keep the same shape with `data: null` and an `errors` list:

```json
{
  "requestId": "…",
  "status": 404,
  "message": "Not found",
  "timestamp": 1794661085259,
  "data": null,
  "errors": [{ "field": null, "message": "Not found" }]
}
```

| Status | Meaning |
| --- | --- |
| `400` | Validation failed (`errors[].field`, `errors[].message`) |
| `401` | No valid session / API key, or wrong credentials on sign-in |
| `403` | Not allowed (e.g. a non-owner managing members, business sign-up) |
| `404` | Unknown, malformed or another customer's record |
| `409` | Conflict (e.g. the email already has an account) |
| `422` | Business rule (e.g. a closed ticket, attachments not supported yet) |
| `423` | Sign-in locked for 15 minutes |

## Language, dates, money

- `Accept-Language: id` or `en` chooses the language of `message` and of
  display labels (`stageLabel`, `dateLabel`, …). Without the header: English.
- Dates are formatted on the **Asia/Jakarta** clock; raw timestamps are unix
  milliseconds.
- Money is **whole rupiah** (the ERP stores minor units and converts).

## Requests

- JSON, or the portal's multipart form where noted: `payload` holds the JSON
  body as a string, files are separate fields. Ticket photos are not stored yet
  (`422`).
- Send an `Idempotency-Key` header on public-website submissions: a replay
  answers `200` with the first reference instead of creating a second lead.

## Signed links

File links in project details are signed object-storage URLs valid for
**5 minutes**. Add the storage origin to the portal's `ERP_ASSET_ORIGINS`.
