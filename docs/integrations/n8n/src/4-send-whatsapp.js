// n8n Code node "4. Send WhatsApp (WAHA)".
//
// Sends every WhatsApp message composed for the event through WAHA
// (POST <WAHA_URL>/api/sendText with X-Api-Key). A failed send throws: the
// execution fails, the webhook answers 500 and the ERP retries the event
// later (the event is only remembered as handled after this node).
// Needs on the n8n server: WAHA_URL, WAHA_API_KEY, WAHA_SESSION (default
// "default").
const item = $input.first().json;
if (item.httpStatus) return [{ json: item }];

const messages = (item.messages || []).filter((message) => message.channel === 'whatsapp');
const baseUrl = String($env.WAHA_URL || '').replace(/\/+$/, '');
if (messages.length > 0 && !baseUrl) throw new Error('WAHA_URL is not set on the n8n server');

const sent = [];
for (const message of messages) {
	await this.helpers.httpRequest({
		method: 'POST',
		url: baseUrl + '/api/sendText',
		headers: { 'X-Api-Key': $env.WAHA_API_KEY || '' },
		body: { session: $env.WAHA_SESSION || 'default', chatId: message.to, text: message.text },
		json: true,
	});
	sent.push(message.to);
}
return [{ json: { ...item, sentWhatsApp: sent } }];
