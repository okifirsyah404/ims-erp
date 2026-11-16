/**
 * Sends a signed sample ERP event to n8n, exactly as the ERP outbox does
 * (same body shape, headers and HMAC), so the workflow can be tested without
 * the ERP.
 *
 *   N8N_WEBHOOK_URL=https://n8n.example.com/webhook/erp-events \
 *   N8N_WEBHOOK_SECRET=... \
 *   bun docs/integrations/n8n/send-test-event.ts <topic|all> [--change=approved] [--bad-signature] [--repeat]
 *
 * `--repeat` sends the same event id twice (the second must be skipped),
 * `--bad-signature` must be refused with 401. Sample contacts are fake.
 */
import { createHmac, randomUUID } from 'node:crypto';
import { samples } from './samples';

const url = process.env.N8N_WEBHOOK_URL;
const secret = process.env.N8N_WEBHOOK_SECRET;
if (!url || !secret) {
	console.error('Set N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET (the same values as in the ERP .env).');
	process.exit(1);
}

const args = process.argv.slice(2);
const topicArg = args.find((arg) => !arg.startsWith('--')) ?? 'all';
const change = args.find((arg) => arg.startsWith('--change='))?.split('=')[1];
const badSignature = args.includes('--bad-signature');
const repeat = args.includes('--repeat');

async function send(topic: string): Promise<void> {
	const make = samples[topic];
	if (!make) throw new Error(`Unknown topic ${topic}. Known: ${Object.keys(samples).join(', ')}`);
	const envelope = { id: randomUUID(), topic, occurredAt: new Date().toISOString(), aggregate: { type: topic.split('.')[0], id: randomUUID() }, data: make(change) };
	const body = JSON.stringify(envelope);
	for (let round = 0; round < (repeat ? 2 : 1); round += 1) {
		const timestamp = String(Date.now());
		const signature = `sha256=${createHmac('sha256', badSignature ? `${secret}-wrong` : secret!).update(`${timestamp}.${body}`).digest('hex')}`;
		const response = await fetch(url!, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Erp-Event-Id': envelope.id, 'X-Erp-Event-Type': topic, 'X-Erp-Timestamp': timestamp, 'X-Erp-Signature': signature },
			body,
		});
		console.log(`${topic}${change ? `:${change}` : ''}${round ? ' (repeat)' : ''} -> ${response.status} ${(await response.text()).slice(0, 200)}`);
	}
}

for (const topic of topicArg === 'all' ? Object.keys(samples) : [topicArg]) await send(topic);
