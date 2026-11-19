import { z } from 'zod';

/**
 * Website content-type registry (ERP-0071 stages 2-4, ADR-0025).
 *
 * One definition per kind of website content. The ERP backend builds the zod
 * validation of `commerce.web_pages.content` from it; the web admin renders
 * the editor form from it; the website reads published content in the same
 * shapes as its built-in data (`apps/web-landing/src/data/*.ts`), so a field
 * the ERP leaves empty keeps the website's default. Field labels are web-admin
 * locale keys `integrations:website.content.field.<key>`.
 */

/** Lucide icon names the website can render (`apps/web-landing/src/lib/icons.ts`). */
export const WEBSITE_ICON_NAMES = [
	'badge-check',
	'building-2',
	'calendar-check',
	'columns-2',
	'construction',
	'cpu',
	'door-open',
	'dumbbell',
	'flame',
	'graduation-cap',
	'headset',
	'landmark',
	'layers',
	'layout-grid',
	'library',
	'plug',
	'plug-zap',
	'qr-code',
	'receipt',
	'rotate-3d',
	'scan-face',
	'shield-check',
	'square-parking',
	'tag',
	'ticket',
	'truck',
	'users-round',
	'wrench',
	'zap',
	'book-open',
	'car',
	'cloud',
	'code',
	'contact',
	'door-closed',
	'key-round',
	'languages',
	'user-check',
	'message-circle',
	'target',
	'eye',
	'award',
	'heart-handshake',
	'lightbulb',
	'users',
	'map-pin',
	'phone',
	'mail',
	'clock',
	'factory',
	'briefcase',
	'server',
	'smartphone',
	'rocket',
	'handshake',
	'sparkles',
	'globe',
	'nfc',
	'scan-line',
	'crosshair',
	'flask-conical',
	'move-horizontal',
] as const;

export type TContentFieldKind =
	| 'text'
	| 'textarea'
	| 'paragraphs'
	| 'number'
	| 'boolean'
	| 'image'
	| 'images'
	| 'icon'
	| 'url'
	| 'date'
	| 'select'
	| 'strings'
	| 'group'
	| 'list';

export type TContentField = {
	key: string;
	kind: TContentFieldKind;
	required?: boolean;
	/** Max length (text), max value (number) or max items (lists). */
	max?: number;
	options?: readonly string[];
	/** Sub-fields of a `group` or of each `list` entry. */
	fields?: readonly TContentField[];
};

export type TContentType = {
	key: string;
	/** One entry only (slug `home`), edited as a page; otherwise a collection. */
	singleton: boolean;
	/** ERP-0071 stage that wires it into the website. */
	stage: 2 | 3 | 4;
	fields: readonly TContentField[];
};

const text = (key: string, max = 300, required = false): TContentField => ({ key, kind: 'text', max, required });
const textarea = (key: string, max = 2000, required = false): TContentField => ({ key, kind: 'textarea', max, required });
const heading = (key: string): TContentField => ({ key, kind: 'group', fields: [text('eyebrow', 80), text('title', 160), textarea('description', 600)] });
const list = (key: string, fields: readonly TContentField[], max = 50): TContentField => ({ key, kind: 'list', max, fields });
const strings = (key: string, max = 50): TContentField => ({ key, kind: 'strings', max });
const icon = (key = 'icon'): TContentField => ({ key, kind: 'icon', options: WEBSITE_ICON_NAMES });
const image = (key = 'image'): TContentField => ({ key, kind: 'image' });
const select = (key: string, options: readonly string[], required = false): TContentField => ({ key, kind: 'select', options, required });
const iconCard = (key: string, max = 12) =>
	list(key, [icon(), text('title', 120, true), text('mobileTitle', 80), textarea('description', 600), textarea('mobileDescription', 300)], max);

export const SOLUTION_KEYS = ['gym', 'tickets', 'visitor', 'library', 'parking', 'access'] as const;
export const PROJECT_INDUSTRIES = ['office', 'parking', 'education', 'fitness', 'venues', 'government'] as const;

export const WEBSITE_CONTENT_TYPES = [
	{
		key: 'home',
		singleton: true,
		stage: 2,
		fields: [
			{
				key: 'hero',
				kind: 'group',
				fields: [
					text('badge', 80),
					text('badgeMobile', 60),
					{ key: 'badgeUrl', kind: 'url' },
					text('titleLead', 80),
					text('titleAccent', 80),
					text('titleTail', 80),
					textarea('description', 400),
					textarea('mobileDescription', 300),
					text('primaryCtaLabel', 40),
					{ key: 'primaryCtaUrl', kind: 'url' },
					text('secondaryCtaLabel', 40),
					{ key: 'secondaryCtaUrl', kind: 'url' },
					image(),
				],
			},
			list('heroStats', [text('value', 20, true), text('label', 80, true), text('shortLabel', 40)], 4),
			heading('trustedHeading'),
			list('trustedClients', [text('name', 60, true)], 12),
			heading('productsHeading'),
			strings('featuredProductSlugs', 8),
			heading('softwareHeading'),
			heading('whyHeading'),
			iconCard('whyItems', 8),
			heading('industriesHeading'),
			list('industries', [icon(), text('name', 80, true), textarea('description', 400), image()], 8),
			heading('projectsHeading'),
			strings('featuredProjectSlugs', 3),
			heading('testimonialsHeading'),
			heading('aboutHeading'),
			strings('aboutChecks', 6),
			heading('contactHeading'),
		],
	},
	{
		key: 'solution',
		singleton: false,
		stage: 3,
		fields: [
			select('key', SOLUTION_KEYS, true),
			text('layerLabel', 80),
			text('mobileLayerLabel', 60),
			text('chipLabel', 40),
			text('windowTitle', 80),
			icon(),
			select('preview', ['blue', 'cyan', 'gray']),
			textarea('description', 600, true),
			textarea('mobileDescription', 300),
			strings('tags', 8),
			strings('mobileTags', 6),
			text('meta', 120),
			text('headline', 200),
			textarea('intro', 1200),
			list('stats', [text('value', 20, true), text('label', 80, true)], 4),
			iconCard('modules', 9),
			list('workflow', [text('title', 120, true), textarea('description', 600)], 8),
			strings('hardware', 12),
			strings('projects', 6),
			strings('industries', 8),
			list('faq', [text('question', 200, true), textarea('answer', 1200, true)], 12),
			textarea('pricingNote', 400),
		],
	},
	{
		key: 'project',
		singleton: false,
		stage: 3,
		fields: [
			select('industry', PROJECT_INDUSTRIES, true),
			text('eyebrow', 80),
			text('client', 120, true),
			text('location', 120),
			{ key: 'year', kind: 'number', max: 2100 },
			text('meta', 160),
			textarea('summary', 600, true),
			image(),
			{ key: 'gallery', kind: 'images', max: 8 },
			list('metrics', [text('value', 20, true), text('label', 80, true)], 4),
			textarea('challenge', 2000),
			textarea('solution', 2000),
			textarea('outcome', 2000),
			strings('scope', 12),
			strings('products', 12),
			strings('solutions', 6),
			{ key: 'featured', kind: 'boolean' },
		],
	},
	{
		key: 'testimonial',
		singleton: false,
		stage: 3,
		fields: [textarea('quote', 800, true), text('author', 120, true), text('role', 120), text('company', 120), text('projectSlug', 128), image('photo')],
	},
	{
		key: 'about',
		singleton: true,
		stage: 4,
		fields: [
			list('stats', [text('value', 20, true), text('label', 80, true), text('mobileLabel', 40)], 6),
			list('companyFacts', [text('label', 80, true), text('value', 160, true), text('mobileValue', 80)], 10),
			{ key: 'vision', kind: 'group', fields: [textarea('statement', 600), text('initials', 4), text('name', 120), text('role', 120)] },
			list('missions', [textarea('text', 400, true), textarea('mobileText', 200)], 8),
			list('pillars', [icon(), text('title', 120, true), textarea('description', 600), textarea('mobileDescription', 300), strings('bullets', 8)], 6),
			iconCard('technologies', 12),
			iconCard('values', 8),
			list('portfolio', [text('tag', 40), text('title', 160, true), text('mobileTitle', 80), image(), text('meta', 160), text('mobileMeta', 80)], 8),
			strings('brandChips', 10),
			{
				key: 'leadership',
				kind: 'group',
				fields: [text('title', 120), textarea('description', 600), list('members', [text('name', 120, true), text('title', 120), textarea('bio', 600), image('portrait')], 12)],
			},
			list('teamGroups', [text('title', 120, true), textarea('description', 600), list('members', [text('name', 120, true), text('title', 120), textarea('bio', 600), image('portrait')], 20)], 8),
			list('offices', [text('title', 120, true), textarea('address', 400), text('phone', 40), text('email', 254), { key: 'primary', kind: 'boolean' }], 6),
		],
	},
	{ key: 'careers', singleton: true, stage: 4, fields: [heading('heading'), iconCard('perks', 8)] },
	{
		key: 'career_role',
		singleton: false,
		stage: 4,
		fields: [text('team', 80, true), text('location', 120, true), text('type', 60, true), textarea('description', 2000), { key: 'applyUrl', kind: 'url' }],
	},
	{
		key: 'news',
		singleton: false,
		stage: 4,
		fields: [text('category', 60, true), textarea('excerpt', 600, true), { key: 'date', kind: 'date', required: true }, { key: 'minutes', kind: 'number', max: 120 }, image(), { key: 'body', kind: 'paragraphs', max: 60 }],
	},
	{ key: 'help_topic', singleton: false, stage: 4, fields: [text('mobileTitle', 60), textarea('description', 400, true), icon()] },
	{
		key: 'help_article',
		singleton: false,
		stage: 4,
		fields: [text('topic', 128, true), textarea('summary', 600, true), { key: 'minutes', kind: 'number', max: 120 }, text('updated', 40), { key: 'body', kind: 'paragraphs', max: 60 }],
	},
	{ key: 'faq_group', singleton: false, stage: 4, fields: [text('mobileLabel', 40), list('items', [text('question', 200, true), textarea('answer', 1200, true)], 30)] },
	{
		key: 'help_document',
		singleton: false,
		stage: 4,
		fields: [
			text('product', 120, true),
			text('category', 60, true),
			{ key: 'languages', kind: 'strings', max: 2 },
			text('type', 40, true),
			text('version', 20),
			text('size', 20),
			text('format', 20),
			{ key: 'updated', kind: 'date' },
			{ key: 'partner', kind: 'boolean' },
			{ key: 'url', kind: 'url' },
		],
	},
	{ key: 'help_video', singleton: false, stage: 4, fields: [text('duration', 20), text('topic', 80), image(), { key: 'url', kind: 'url' }] },
	{ key: 'training_course', singleton: false, stage: 4, fields: [text('level', 40), text('duration', 40), textarea('description', 600), icon()] },
	{ key: 'legal', singleton: false, stage: 4, fields: [textarea('description', 400), text('updated', 40), list('sections', [text('title', 160, true), { key: 'body', kind: 'paragraphs', max: 30 }], 30)] },
	{
		key: 'warranty',
		singleton: true,
		stage: 4,
		fields: [
			list('coverage', [text('title', 120, true), textarea('detail', 400), { key: 'covered', kind: 'boolean' }], 12),
			list('steps', [icon(), text('title', 120, true), textarea('text', 400)], 6),
			list('plans', [text('name', 80, true), text('term', 60), text('price', 60), strings('features', 10), { key: 'highlight', kind: 'boolean' }], 4),
		],
	},
	{
		key: 'installation',
		singleton: true,
		stage: 4,
		fields: [list('services', [icon(), text('title', 120, true), textarea('text', 400), text('time', 40)], 8), list('process', [text('title', 120, true), textarea('text', 400)], 8), strings('cities', 20)],
	},
] as const satisfies readonly TContentType[];

export type TWebsiteContentTypeKey = (typeof WEBSITE_CONTENT_TYPES)[number]['key'];

export function websiteContentType(key: string): TContentType | undefined {
	return (WEBSITE_CONTENT_TYPES as readonly TContentType[]).find((type) => type.key === key);
}

/** An image: an uploaded asset (`asset:<uuid>`), a site path (`/images/x.webp`) or an https URL. */
export const websiteImageSchema = z
	.string()
	.trim()
	.max(500)
	.refine((value) => /^asset:[0-9a-f-]{36}$/i.test(value) || /^\/(?!\/)[^\s]*$/.test(value) || /^https:\/\/[^\s]+$/i.test(value), {
		message: 'Use an uploaded image, a site path or an https:// link',
	});

/** A link: a site path or an https / mailto / tel link (never `javascript:` or `//host`). */
export const websiteLinkSchema = z
	.string()
	.trim()
	.max(500)
	.refine((value) => /^\/(?!\/)/.test(value) || /^https:\/\/[^\s]+$/i.test(value) || /^(mailto|tel):[^\s]+$/i.test(value), {
		message: 'Use a site path starting with "/" or an https:// link',
	});

function fieldSchema(field: TContentField): z.ZodType {
	const optional = (schema: z.ZodType) => (field.required ? schema : schema.optional());
	switch (field.kind) {
		case 'text':
			return optional(field.required ? z.string().trim().min(1).max(field.max ?? 300) : z.string().trim().max(field.max ?? 300));
		case 'textarea':
			return optional(field.required ? z.string().trim().min(1).max(field.max ?? 2000) : z.string().trim().max(field.max ?? 2000));
		case 'paragraphs':
			return optional(z.array(z.string().trim().min(1).max(4000)).max(field.max ?? 60));
		case 'number':
			return optional(z.number().int().min(0).max(field.max ?? 1_000_000));
		case 'boolean':
			return optional(z.boolean());
		case 'image':
			return optional(websiteImageSchema);
		case 'images':
			return optional(z.array(websiteImageSchema).max(field.max ?? 12));
		case 'icon':
		case 'select':
			return optional(z.enum(field.options as [string, ...string[]]));
		case 'url':
			return optional(websiteLinkSchema);
		case 'date':
			return optional(z.iso.date());
		case 'strings':
			return optional(z.array(z.string().trim().min(1).max(200)).max(field.max ?? 50));
		case 'group':
			return optional(objectSchema(field.fields ?? []));
		case 'list':
			return optional(z.array(objectSchema(field.fields ?? [])).max(field.max ?? 50));
	}
}

function objectSchema(fields: readonly TContentField[]): z.ZodObject {
	return z.object(Object.fromEntries(fields.map((field) => [field.key, fieldSchema(field)])));
}

/** The zod schema of one content type's `content` object (unknown keys are dropped). */
export function websiteContentSchema(type: TContentType): z.ZodObject {
	return objectSchema(type.fields);
}

/** Every `asset:<id>` reference inside a content object (to resolve or to check). */
export function websiteAssetRefs(value: unknown, found: Set<string> = new Set()): Set<string> {
	if (typeof value === 'string') {
		const match = /^asset:([0-9a-f-]{36})$/i.exec(value);
		if (match) found.add(match[1]!.toLowerCase());
	} else if (Array.isArray(value)) {
		for (const entry of value) websiteAssetRefs(entry, found);
	} else if (value && typeof value === 'object') {
		for (const entry of Object.values(value)) websiteAssetRefs(entry, found);
	}
	return found;
}

/** Every distinct field key in the registry (for the editor's label keys). */
export function websiteContentFieldKeys(): string[] {
	const keys = new Set<string>();
	const walk = (fields: readonly TContentField[]) => {
		for (const field of fields) {
			keys.add(field.key);
			if (field.fields) walk(field.fields);
		}
	};
	for (const type of WEBSITE_CONTENT_TYPES as readonly TContentType[]) walk(type.fields);
	return [...keys].sort();
}
