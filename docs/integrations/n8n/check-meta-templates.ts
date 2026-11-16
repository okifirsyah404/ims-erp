/**
 * Runs the "3. Compose messages" node code against every sample event (all
 * topics, every `change`) with every recipient switched on, and checks each
 * WhatsApp message against meta-templates.json: the template exists and gets
 * exactly as many variables as its body has, none of them empty or holding a
 * new line (Meta refuses those).
 *
 *   bun docs/integrations/n8n/check-meta-templates.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { samples } from './samples';

const here = import.meta.dir;
const catalog = JSON.parse(readFileSync(join(here, 'meta-templates.json'), 'utf8')) as {
	templates: { name: string; body: string; example: string[] }[];
};
const byName = new Map(catalog.templates.map((template) => [template.name, template]));
const placeholders = (body: string) => new Set(body.match(/\{\{\d+\}\}/g) ?? []).size;

let code = readFileSync(join(here, 'src', '3-compose-messages.js'), 'utf8');
// Every role gets a number and customers/suppliers are on, so every branch runs.
code = code.replace(/(\t\t\w+): \[\],/g, "$1: ['081100000000'],").replace('notifyCustomers: false', 'notifyCustomers: true').replace('notifySuppliers: false', 'notifySuppliers: true');
const compose = new Function('$input', `return (async () => {\n${code}\n})();`) as (input: unknown) => Promise<{ json: { messages: { channel: string; template: string | null; params: string[]; audience: string }[] } }[]>;

const changes: Record<string, (string | undefined)[]> = {
	'service_ticket.updated': ['created', 'assigned', 'started', 'resolved', 'reopened', 'closed'],
	'purchase_return.updated': ['submitted', 'approved', 'rejected', 'shipped', 'cancelled'],
	'sales_return.updated': ['submitted', 'approved', 'rejected', 'received', 'cancelled'],
	'supplier_bill.due': ['upcoming', 'due', 'overdue'],
};

const problems: string[] = [];
const used = new Set<string>();
let checked = 0;
for (const [topic, make] of Object.entries(samples)) {
	for (const change of changes[topic] ?? [undefined]) {
		const [result] = await compose({ first: () => ({ json: { eventId: 'e', topic, data: make(change) } }) });
		for (const message of result!.json.messages.filter((m) => m.channel === 'whatsapp')) {
			checked += 1;
			const where = `${topic}${change ? `:${change}` : ''} -> ${message.audience}`;
			const template = message.template ? byName.get(message.template) : undefined;
			if (!template) {
				problems.push(`${where}: no template (${message.template ?? 'none'})`);
				continue;
			}
			used.add(template.name);
			if (placeholders(template.body) !== message.params.length) {
				problems.push(`${where}: ${template.name} needs ${placeholders(template.body)} params, got ${message.params.length}`);
			}
			if (template.example.length !== placeholders(template.body)) problems.push(`${template.name}: example count does not match the body`);
			for (const value of message.params) {
				if (!value || /[\n\t]/.test(value) || / {4,}/.test(value)) problems.push(`${where}: bad param ${JSON.stringify(value)}`);
			}
		}
	}
}
for (const name of byName.keys()) if (!used.has(name)) problems.push(`${name}: in the catalog but never used`);

console.log(`${checked} WhatsApp messages checked against ${byName.size} templates`);
if (problems.length) {
	console.log(problems.join('\n'));
	process.exit(1);
}
console.log('OK');
