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

/** n8n data table holding handled event ids (created on first run). */
const TABLE = 'erp_processed_events';
const tableRef = { __rl: true, mode: 'name', value: TABLE };

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
		{
			id: 'a1d5e1f0-0000-4000-8000-00000000000a',
			name: '2a. Ensure table',
			type: 'n8n-nodes-base.dataTable',
			typeVersion: 1.1,
			position: [440, 0],
			parameters: {
				resource: 'table',
				operation: 'create',
				tableName: TABLE,
				columns: { column: [{ name: 'event_id', type: 'string' }, { name: 'topic', type: 'string' }] },
				options: { createIfNotExists: true },
			},
		},
		{
			id: 'a1d5e1f0-0000-4000-8000-00000000000b',
			name: '2b. Look up event',
			type: 'n8n-nodes-base.dataTable',
			typeVersion: 1.1,
			position: [660, 0],
			alwaysOutputData: true,
			parameters: {
				resource: 'row',
				operation: 'get',
				dataTableId: tableRef,
				matchType: 'anyCondition',
				filters: { conditions: [{ keyName: 'event_id', condition: 'eq', keyValue: "={{ $('1. Verify ERP signature').first().json.eventId || 'not-an-event' }}" }] },
				returnAll: false,
				limit: 1,
			},
		},
		codeNode('a1d5e1f0-0000-4000-8000-000000000003', '2c. Skip duplicates', '2-skip-duplicates.js', 880, 0),
		codeNode('a1d5e1f0-0000-4000-8000-000000000004', '3. Compose messages', '3-compose-messages.js', 1100, 0),
		codeNode('a1d5e1f0-0000-4000-8000-000000000005', '4. Send WhatsApp (WAHA / Meta)', '4-send-whatsapp.js', 1320, 0),
		{
			id: 'a1d5e1f0-0000-4000-8000-00000000000c',
			name: '5a. Record event',
			type: 'n8n-nodes-base.dataTable',
			typeVersion: 1.1,
			position: [1540, 0],
			parameters: {
				resource: 'row',
				operation: 'upsert',
				dataTableId: tableRef,
				matchType: 'anyCondition',
				filters: { conditions: [{ keyName: 'event_id', condition: 'eq', keyValue: "={{ $json.eventId || 'rejected' }}" }] },
				columns: {
					mappingMode: 'defineBelow',
					value: { event_id: "={{ $json.eventId || 'rejected' }}", topic: "={{ $json.topic || '' }}" },
					matchingColumns: [],
					schema: [
						{ id: 'event_id', displayName: 'event_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
						{ id: 'topic', displayName: 'topic', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
					],
					attemptToConvertTypes: false,
					convertFieldsToString: false,
				},
				options: {},
			},
		},
		codeNode('a1d5e1f0-0000-4000-8000-000000000006', '5b. Finish', '5-remember-event.js', 1760, 0),
		{
			id: 'a1d5e1f0-0000-4000-8000-000000000007',
			name: 'Answer the ERP',
			type: 'n8n-nodes-base.respondToWebhook',
			typeVersion: 1.1,
			position: [1980, 0],
			parameters: {
				respondWith: 'json',
				responseBody: '={{ { "result": $json.result, "messages": ($json.messages || []).length } }}',
				options: { responseCode: '={{ $json.httpStatus || 200 }}' },
			},
		},
		codeNode('a1d5e1f0-0000-4000-8000-000000000008', '6. Email messages', '6-email-messages.js', 1980, 220),
		{
			id: 'a1d5e1f0-0000-4000-8000-000000000009',
			name: 'Send email',
			type: 'n8n-nodes-base.emailSend',
			typeVersion: 2.1,
			position: [2200, 220],
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
		'1. Verify ERP signature': { main: [[{ node: '2a. Ensure table', type: 'main', index: 0 }]] },
		'2a. Ensure table': { main: [[{ node: '2b. Look up event', type: 'main', index: 0 }]] },
		'2b. Look up event': { main: [[{ node: '2c. Skip duplicates', type: 'main', index: 0 }]] },
		'2c. Skip duplicates': { main: [[{ node: '3. Compose messages', type: 'main', index: 0 }]] },
		'3. Compose messages': { main: [[{ node: '4. Send WhatsApp (WAHA / Meta)', type: 'main', index: 0 }]] },
		'4. Send WhatsApp (WAHA / Meta)': { main: [[{ node: '5a. Record event', type: 'main', index: 0 }]] },
		'5a. Record event': { main: [[{ node: '5b. Finish', type: 'main', index: 0 }]] },
		'5b. Finish': {
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
