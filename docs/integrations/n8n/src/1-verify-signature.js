// n8n Code node "1. Verify ERP signature" (ERP -> n8n event router).
//
// The ERP signs every event: X-Erp-Signature = "sha256=" + HMAC-SHA256 of
// "<X-Erp-Timestamp>.<raw JSON body>" with N8N_WEBHOOK_SECRET. The ERP builds
// the body with JSON.stringify, so re-serialising the parsed body gives the
// same bytes. Needs on the n8n server: ERP_WEBHOOK_SECRET (= the ERP's
// N8N_WEBHOOK_SECRET), NODE_FUNCTION_ALLOW_BUILTIN=crypto and
// N8N_BLOCK_ENV_ACCESS_IN_NODE=false.
//
// Never throws for a bad request: it marks the item `httpStatus` 401/400 so
// the last node answers with that code and the ERP stops retrying.
const crypto = require('crypto');

const MAX_AGE_MS = 10 * 60 * 1000;
const item = $input.first().json;
const headers = item.headers || {};
const body = item.body || {};
const secret = $env.ERP_WEBHOOK_SECRET;

if (!secret) {
	// A server misconfiguration: 500 so the ERP keeps the event and retries.
	throw new Error('ERP_WEBHOOK_SECRET is not set on the n8n server');
}

const timestamp = String(headers['x-erp-timestamp'] || '');
const given = String(headers['x-erp-signature'] || '');
const expected =
	'sha256=' + crypto.createHmac('sha256', secret).update(timestamp + '.' + JSON.stringify(body)).digest('hex');
const signatureOk =
	given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
const age = Math.abs(Date.now() - Number(timestamp));

if (!signatureOk) {
	return [{ json: { httpStatus: 401, result: 'bad signature' } }];
}
if (!Number.isFinite(age) || age > MAX_AGE_MS) {
	return [{ json: { httpStatus: 401, result: 'timestamp outside 10 minutes (replay?)' } }];
}
if (!body.topic || !body.data) {
	return [{ json: { httpStatus: 400, result: 'not an ERP event' } }];
}

return [
	{
		json: {
			eventId: String(headers['x-erp-event-id'] || body.id),
			topic: body.topic,
			occurredAt: body.occurredAt,
			aggregate: body.aggregate,
			data: body.data,
		},
	},
];
