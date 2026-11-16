/**
 * Builds `erp-event-router.workflow.json` (the importable n8n workflow) from
 * the Code node sources in `src/`. Edit the sources, then run:
 *
 *   bun docs/integrations/n8n/build-workflow.ts
 *
 * The JSON is committed so it can be imported without building.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const here = import.meta.dir;
const code = (file: string) => readFileSync(join(here, 'src', file), 'utf8');

const codeNode = (id: string, name: string, file: string, x: number, y: number) => ({
	id,
	name,
	type: 'n8n-nodes-base.code',
	typeVersion: 2,
	position: [x, y],
	parameters: { jsCode: code(file) },
});

const workflow = {
	name: 'ERP events → WhatsApp (IMS ERP)',
	nodes: [
		{
			id: 'a1d5e1f0-0000-4000-8000-000000000001',
			name: 'ERP webhook',
			type: 'n8n-nodes-base.webhook',
			typeVersion: 2,
			position: [0, 0],
			webhookId: 'a1d5e1f0-0000-4000-8000-0000000000aa',
			parameters: { httpMethod: 'POST', path: 'erp-events', responseMode: 'responseNode', options: {} },
		},
		codeNode('a1d5e1f0-0000-4000-8000-000000000002', '1. Verify ERP signature', '1-verify-signature.js', 220, 0),
		codeNode('a1d5e1f0-0000-4000-8000-000000000003', '2. Skip duplicates', '2-skip-duplicates.js', 440, 0),
		codeNode('a1d5e1f0-0000-4000-8000-000000000004', '3. Compose messages', '3-compose-messages.js', 660, 0),
		codeNode('a1d5e1f0-0000-4000-8000-000000000005', '4. Send WhatsApp (WAHA)', '4-send-whatsapp.js', 880, 0),
		codeNode('a1d5e1f0-0000-4000-8000-000000000006', '5. Remember event', '5-remember-event.js', 1100, 0),
		{
			id: 'a1d5e1f0-0000-4000-8000-000000000007',
			name: 'Answer the ERP',
			type: 'n8n-nodes-base.respondToWebhook',
			typeVersion: 1.1,
			position: [1320, 0],
			parameters: {
				respondWith: 'json',
				responseBody: '={{ { "result": $json.result, "messages": ($json.messages || []).length } }}',
				options: { responseCode: '={{ $json.httpStatus || 200 }}' },
			},
		},
		codeNode('a1d5e1f0-0000-4000-8000-000000000008', '6. Email messages', '6-email-messages.js', 1320, 220),
		{
			id: 'a1d5e1f0-0000-4000-8000-000000000009',
			name: 'Send email',
			type: 'n8n-nodes-base.emailSend',
			typeVersion: 2.1,
			position: [1540, 220],
			disabled: true,
			onError: 'continueRegularOutput',
			parameters: {
				fromEmail: '={{ $env.ERP_NOTIFY_FROM_EMAIL || "erp@example.com" }}',
				toEmail: '={{ $json.to }}',
				subject: '={{ $json.subject }}',
				emailFormat: 'text',
				text: '={{ $json.text }}',
				options: {},
			},
		},
	],
	connections: {
		'ERP webhook': { main: [[{ node: '1. Verify ERP signature', type: 'main', index: 0 }]] },
		'1. Verify ERP signature': { main: [[{ node: '2. Skip duplicates', type: 'main', index: 0 }]] },
		'2. Skip duplicates': { main: [[{ node: '3. Compose messages', type: 'main', index: 0 }]] },
		'3. Compose messages': { main: [[{ node: '4. Send WhatsApp (WAHA)', type: 'main', index: 0 }]] },
		'4. Send WhatsApp (WAHA)': { main: [[{ node: '5. Remember event', type: 'main', index: 0 }]] },
		'5. Remember event': {
			main: [
				[
					{ node: 'Answer the ERP', type: 'main', index: 0 },
					{ node: '6. Email messages', type: 'main', index: 0 },
				],
			],
		},
		'6. Email messages': { main: [[{ node: 'Send email', type: 'main', index: 0 }]] },
	},
	settings: { executionOrder: 'v1', saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all' },
	pinData: {},
};

writeFileSync(join(here, 'erp-event-router.workflow.json'), `${JSON.stringify(workflow, null, '\t')}\n`);
console.log('wrote erp-event-router.workflow.json');
