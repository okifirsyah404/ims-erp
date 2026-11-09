// Creates an organization-owned API key for the public website
// (`/public/v1/*`, config `website`, ADR-0011 step 3b). The plaintext key is printed ONCE;
// only its hash is stored. Put it in the website server's ERP_API_TOKEN
// env var and never commit or share it. Usage:
//   bun run scripts/create-website-api-key.ts <organization-slug> [name]
// List / revoke later through Better Auth's API key endpoints.
import { and, eq } from 'drizzle-orm';
import { drizzleDB } from '../drizzle/db';
import { members, organizations } from '../drizzle/schemas/auth.schema';
import { auth } from '../src/providers/better-auth/auth';
import { WEBSITE_API_KEY_CONFIG_ID } from '../src/providers/better-auth/plugins/api-key.auth';
import { closeQueueConnection } from '../src/providers/queue/queue.connection';

const [slug, name = 'website'] = process.argv.slice(2);
if (!slug) {
	console.error('Usage: bun run scripts/create-website-api-key.ts <organization-slug> [name]');
	process.exit(1);
}

async function main(): Promise<number> {
	const [organization] = await drizzleDB
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.slug, slug))
		.limit(1);
	if (!organization) {
		console.error('Organization not found:', slug);
		return 1;
	}
	// Better Auth checks the creator's org permission; the owner has it.
	const [owner] = await drizzleDB
		.select({ userId: members.userId })
		.from(members)
		.where(and(eq(members.organizationId, organization.id), eq(members.role, 'owner')))
		.limit(1);
	if (!owner) {
		console.error('No owner member in organization:', slug);
		return 1;
	}

	const api = auth.api as unknown as {
		createApiKey(input: {
			body: {
				configId: string;
				organizationId: string;
				userId: string;
				name: string;
				metadata?: Record<string, unknown>;
			};
		}): Promise<{ id: string; key: string; start: string | null }>;
	};
	const created = await api.createApiKey({
		body: {
			configId: WEBSITE_API_KEY_CONFIG_ID,
			organizationId: organization.id,
			userId: owner.userId,
			name,
			metadata: { purpose: 'public-website' },
		},
	});
	console.log(`Created website API key ${created.id} (${name}) for ${slug}.`);
	console.log('Copy it now into the website ERP_API_TOKEN; it is not shown again:');
	console.log(created.key);
	return 0;
}

const code = await main().catch((error: unknown) => {
	console.error('Failed to create the API key:', error instanceof Error ? error.message : error);
	return 1;
});
await closeQueueConnection();
process.exit(code);
