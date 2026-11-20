import { describe, expect, test } from 'bun:test';
import { WEBSITE_CONTENT_TYPES, websiteContentFieldKeys } from '@ims-erp/common';
import { en as bundles } from '@ims-erp/locales';
import { cleanContent } from '../../src/lib/website-content-form';

/**
 * The website content editor (ERP-0071) renders its form from the shared
 * registry and composes label keys, so a registry field or type without a
 * label would show a raw key. Parity with `id` is the locale guards' job.
 */
describe('website content editor labels', () => {
	const keys = new Set(Object.keys(bundles.integrations));

	test('every registry field has a label', () => {
		expect(websiteContentFieldKeys().filter((key) => !keys.has(`website.content.field.${key}`))).toEqual([]);
	});

	test('every content type has a label', () => {
		expect(WEBSITE_CONTENT_TYPES.map((type) => type.key).filter((key) => !keys.has(`website.content.type.${key}`))).toEqual([]);
	});

	test('no label is left for a field the registry dropped', () => {
		const fields = new Set(websiteContentFieldKeys());
		const stale = [...keys].filter((key) => key.startsWith('website.content.field.') && !fields.has(key.slice('website.content.field.'.length)));
		expect(stale).toEqual([]);
	});
});

describe('cleanContent', () => {
	test('drops empty text, lists and groups so the website keeps its defaults', () => {
		expect(
			cleanContent({
				title: '  Hello ',
				badge: '   ',
				tags: ['a', '', ' '],
				gallery: [''],
				hero: { title: '', description: '' },
				items: [{ question: 'Q', answer: '' }, {}],
				featured: true,
				minutes: 0,
			}),
		).toEqual({ title: 'Hello', tags: ['a'], items: [{ question: 'Q' }], featured: true, minutes: 0 });
	});
});
