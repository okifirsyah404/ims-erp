import { and, eq, isNull } from 'drizzle-orm';
import pino from 'pino';
import { isProductionEnv } from '../../../config/providers/env';
import { drizzleDB } from '../../../drizzle/db';
import { webMenuItems, webMenus, webPages, webSites, type WebPageType } from '../../../drizzle/schemas/commerce.schema';
import websiteContent from '../data/website-content.json' with { type: 'json' };

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * The website's current built-in identity and navigation (apps/web-landing
 * `src/data/site.ts`), so a development ERP starts from what the site shows
 * today. Fixed content, never faker-generated.
 */
const SITE = {
	brandName: 'ENTRAGATE',
	legalName: 'CV. Inti Multi Solusi',
	tagline: 'by CV. Inti Multi Solusi',
	address: 'Jl. Raya Industri No. 88, Bekasi, Jawa Barat',
	phone: '+62 21 8899 2020',
	email: 'sales@entragate.co.id',
	whatsapp: null,
	hotlineHours: 'Mon–Fri · 08:00–17:00',
	supportEmail: 'support@entragate.co.id',
	supportWhatsapp: '+62 811 1900 288',
	socialLinks: [],
	defaultSeoTitle: 'Entragate — Access control & gate systems',
	defaultSeoDescription: 'Barrier gates, turnstiles, face recognition and access-control software, installed and maintained by CV. Inti Multi Solusi.',
};

const MAIN = {
	name: 'Main navigation',
	items: [
		['Home', '/'],
		['Products', '/products'],
		['Software Solutions', '/solutions'],
		['Projects', '/projects'],
		['Track Order', '/track'],
		['About IMS', '/about'],
		['Contact', '/contact'],
	],
};

const FOOTER = {
	name: 'Footer',
	columns: [
		{
			name: 'Products',
			items: [
				['Swing Barrier Gate', '/products?category=swing-barrier-gate'],
				['Flap Barrier Gate', '/products?category=flap-barrier-gate'],
				['Tripod Turnstile', '/products?category=tripod-turnstile'],
				['Parking Barrier', '/products?category=parking-barrier'],
				['Face Recognition', '/products?category=face-recognition'],
				['Access Controllers', '/products?category=access-controllers'],
			],
		},
		{
			name: 'Software',
			items: [
				['Gym Management', '/solutions/gym-management'],
				['E-Ticketing', '/solutions/e-ticketing'],
				['Visitor Management', '/solutions/visitor-management'],
				['Library Management', '/solutions/library-management'],
				['Smart Parking', '/solutions/smart-parking'],
				['Access Control', '/solutions/access-control'],
			],
		},
		{
			name: 'Company',
			items: [
				['About IMS', '/about'],
				['Projects', '/projects'],
				['Careers', '/careers'],
				['News & Insights', '/news'],
				['Contact', '/contact'],
			],
		},
		{
			name: 'Support',
			items: [
				['Track Order', '/track'],
				['Warranty Claim', '/warranty'],
				['Installation', '/installation'],
				['Documentation', '/help/documents'],
				['FAQ', '/help'],
				['Support Center', '/help'],
			],
		},
	],
};

const items = (menuId: string, rows: string[][], now: Date) =>
	rows.map(([label, url], position) => ({ webMenuId: menuId, label: label!, url: url!, position, createdAt: now, updatedAt: now }));

/**
 * Seeds the website identity and its `main` / `footer` menus (ERP-0071
 * stage 1). Idempotent: an existing site row or menu is left as edited.
 * Skipped in production, where marketing fills them in from the web admin.
 */
export async function seedCommerceWebsite(): Promise<void> {
	if (isProductionEnv()) {
		logger.info('Production environment; skipping website identity and menus');
		return;
	}
	const now = new Date();
	const [site] = await drizzleDB.select().from(webSites).where(and(eq(webSites.siteKey, 'default'), isNull(webSites.deletedAt))).limit(1);
	if (!site) await drizzleDB.insert(webSites).values({ ...SITE, siteKey: 'default', createdAt: now, updatedAt: now });

	const menuExists = async (code: string) =>
		(await drizzleDB.select({ id: webMenus.id }).from(webMenus).where(and(eq(webMenus.code, code), isNull(webMenus.deletedAt))).limit(1)).length > 0;

	let inserted = 0;
	if (!(await menuExists('main'))) {
		const [main] = await drizzleDB.insert(webMenus).values({ code: 'main', name: MAIN.name, createdAt: now, updatedAt: now }).returning();
		await drizzleDB.insert(webMenuItems).values(items(main!.id, MAIN.items, now));
		inserted += 1;
	}
	if (!(await menuExists('footer'))) {
		const [footer] = await drizzleDB.insert(webMenus).values({ code: 'footer', name: FOOTER.name, createdAt: now, updatedAt: now }).returning();
		for (const [position, column] of FOOTER.columns.entries()) {
			const [child] = await drizzleDB
				.insert(webMenus)
				.values({ code: `footer-${position + 1}`, name: column.name, parentMenuId: footer!.id, position, createdAt: now, updatedAt: now })
				.returning();
			await drizzleDB.insert(webMenuItems).values(items(child!.id, column.items, now));
		}
		inserted += 1;
	}
	logger.info({ siteInserted: !site, menusInserted: inserted }, 'Website identity and menus seeded');
}

type TSeedEntry = { pageType: WebPageType; slug: string; title: string; position: number; content: Record<string, unknown> };

/**
 * Seeds the website content (ERP-0071 stages 2-4) as published entries:
 * `database/seeders/data/website-content.json` was generated once from the
 * website's built-in data (`apps/web-landing/src/data/*.ts`) and validated
 * with the shared content-type registry, so a development ERP shows what the
 * site shows today. Legal, warranty and installation pages are not seeded
 * (the website keeps its built-in text until they are written in the ERP).
 * Idempotent per (page_type, slug); skipped in production.
 */
export async function seedCommerceWebsiteContent(): Promise<void> {
	if (isProductionEnv()) {
		logger.info('Production environment; skipping website content');
		return;
	}
	const now = new Date();
	let inserted = 0;
	for (const entry of websiteContent as TSeedEntry[]) {
		const [existing] = await drizzleDB
			.select({ id: webPages.id })
			.from(webPages)
			.where(and(eq(webPages.pageType, entry.pageType), eq(webPages.slug, entry.slug), isNull(webPages.deletedAt)))
			.limit(1);
		if (existing) continue;
		await drizzleDB.insert(webPages).values({ ...entry, status: 'published', publishedAt: now, createdAt: now, updatedAt: now });
		inserted += 1;
	}
	logger.info({ inserted, total: websiteContent.length }, 'Website content seeded');
}
