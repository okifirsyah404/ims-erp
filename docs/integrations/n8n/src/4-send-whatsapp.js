// n8n Code node "4. Send WhatsApp (WAHA or Meta)".
//
// WHATSAPP_PROVIDER picks the sender:
// - "waha" (default): POST <WAHA_URL>/api/sendText with X-Api-Key and the
//   free text (a message with a `file`, e.g. the quotation PDF, goes to
//   /api/sendFile with the text as caption). Needs WAHA_URL, WAHA_API_KEY,
//   WAHA_SESSION.
// - "meta": the official WhatsApp Cloud API. A message the business starts
//   must be an APPROVED template (docs/integrations/n8n/meta-templates.json):
//   POST <META_GRAPH_URL>/<META_GRAPH_VERSION>/<META_PHONE_NUMBER_ID>/messages
//   with Authorization: Bearer <META_ACCESS_TOKEN>. Needs
//   META_PHONE_NUMBER_ID, META_ACCESS_TOKEN; optional META_GRAPH_VERSION
//   (default v23.0), META_TEMPLATE_LANGUAGE (default "id"), META_GRAPH_URL
//   (default https://graph.facebook.com). A message with a `file` fills the
//   template's DOCUMENT header with the file's link.
//
// A failed send throws: the execution fails, the webhook answers 500 and the
// ERP retries the event later (the event is only remembered as handled after
// this node).
const item = $input.first().json;
if (item.httpStatus) return [{ json: item }];

const messages = (item.messages || []).filter((message) => message.channel === 'whatsapp');
const provider = String($env.WHATSAPP_PROVIDER || 'waha').toLowerCase();
const sent = [];
const skipped = [];

if (provider === 'meta') {
	const phoneNumberId = $env.META_PHONE_NUMBER_ID;
	const token = $env.META_ACCESS_TOKEN;
	if (messages.length > 0 && (!phoneNumberId || !token)) {
		throw new Error('META_PHONE_NUMBER_ID / META_ACCESS_TOKEN are not set on the n8n server');
	}
	const base = String($env.META_GRAPH_URL || 'https://graph.facebook.com').replace(/\/+$/, '');
	const version = $env.META_GRAPH_VERSION || 'v23.0';
	for (const message of messages) {
		if (!message.template) {
			// No approved template for this message: Meta would refuse free text
			// outside the 24-hour customer service window.
			skipped.push(message.to);
			continue;
		}
		const components = [{ type: 'body', parameters: (message.params || []).map((text) => ({ type: 'text', text: String(text) })) }];
		if (message.file) {
			components.unshift({ type: 'header', parameters: [{ type: 'document', document: { link: message.file.url, filename: message.file.filename } }] });
		}
		await this.helpers.httpRequest({
			method: 'POST',
			url: base + '/' + version + '/' + phoneNumberId + '/messages',
			headers: { Authorization: 'Bearer ' + token },
			body: {
				messaging_product: 'whatsapp',
				recipient_type: 'individual',
				to: message.to.replace(/@c\.us$/, ''),
				type: 'template',
				template: {
					name: message.template,
					language: { code: $env.META_TEMPLATE_LANGUAGE || 'id' },
					components,
				},
			},
			json: true,
		});
		sent.push(message.to);
	}
} else {
	const baseUrl = String($env.WAHA_URL || '').replace(/\/+$/, '');
	if (messages.length > 0 && !baseUrl) throw new Error('WAHA_URL is not set on the n8n server');
	for (const message of messages) {
		const session = $env.WAHA_SESSION || 'default';
		await this.helpers.httpRequest({
			method: 'POST',
			url: baseUrl + (message.file ? '/api/sendFile' : '/api/sendText'),
			headers: { 'X-Api-Key': $env.WAHA_API_KEY || '' },
			body: message.file
				? { session, chatId: message.to, file: { url: message.file.url, filename: message.file.filename, mimetype: message.file.mimetype }, caption: message.text }
				: { session, chatId: message.to, text: message.text },
			json: true,
		});
		sent.push(message.to);
	}
}
return [{ json: { ...item, provider, sentWhatsApp: sent, skippedWithoutTemplate: skipped } }];
