/**
 * Submits the templates in meta-templates.json to the WhatsApp Business
 * Account (WABA) for Meta's review, as UTILITY templates in Indonesian.
 * Templates that already exist are reported and left alone.
 *
 *   META_WABA_ID=<WhatsApp Business Account id> \
 *   META_ACCESS_TOKEN=<system user token with whatsapp_business_management> \
 *   bun docs/integrations/n8n/create-meta-templates.ts [--dry-run]
 *
 * Optional: META_GRAPH_VERSION (default v23.0), META_GRAPH_URL.
 * Review can take up to 24 hours; only APPROVED templates can be sent.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const catalog = JSON.parse(readFileSync(join(import.meta.dir, 'meta-templates.json'), 'utf8')) as {
	language: string;
	templates: { name: string; header?: 'DOCUMENT'; body: string; example: string[] }[];
};
const dryRun = process.argv.includes('--dry-run');
const waba = process.env.META_WABA_ID;
const token = process.env.META_ACCESS_TOKEN;
const base = `${(process.env.META_GRAPH_URL ?? 'https://graph.facebook.com').replace(/\/+$/, '')}/${process.env.META_GRAPH_VERSION ?? 'v23.0'}`;

if (!dryRun && (!waba || !token)) {
	console.error('Set META_WABA_ID and META_ACCESS_TOKEN, or pass --dry-run.');
	process.exit(1);
}

for (const template of catalog.templates) {
	if (template.header === 'DOCUMENT') {
		// The API wants a sample PDF uploaded first (a media handle); WhatsApp
		// Manager takes the same template with a file picker. See README.
		console.log(`${template.name}: skipped - has a DOCUMENT header, create it in WhatsApp Manager (docs/user-guide/whatsapp-business-meta.*.md, section 4)`);
		continue;
	}
	const payload = {
		name: template.name,
		language: catalog.language,
		category: 'UTILITY',
		components: [{ type: 'BODY', text: template.body, example: { body_text: [template.example] } }],
	};
	if (dryRun) {
		console.log(JSON.stringify(payload));
		continue;
	}
	const response = await fetch(`${base}/${waba}/message_templates`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const result = (await response.json()) as { id?: string; status?: string; category?: string; error?: { message?: string; error_user_msg?: string } };
	if (response.ok) {
		console.log(`${template.name}: submitted (${result.status ?? 'PENDING'}, category ${result.category ?? 'UTILITY'})`);
	} else {
		console.log(`${template.name}: ${response.status} ${result.error?.error_user_msg ?? result.error?.message ?? 'error'}`);
	}
}
