import { beforeAll, describe, expect, test } from 'bun:test';
import i18n from 'i18next';
import { renderToString } from 'react-dom/server';
import { initReactI18next } from 'react-i18next';

import { EmptyState, ErrorState, errorMessage } from '@/components/empty-state';
import { PageSkeleton, SectionSkeleton } from '@/components/page-skeleton';

beforeAll(async () => {
	await i18n.use(initReactI18next).init({
		lng: 'en',
		fallbackLng: 'en',
		ns: ['common'],
		defaultNS: 'common',
		resources: {
			en: {
				common: { 'error.failed': 'Failed', 'state.loading': 'Loading.' },
			},
		},
		keySeparator: false,
		interpolation: { escapeValue: false },
	});
});

describe('errorMessage', () => {
	test('reads Error, string and ignores everything else', () => {
		expect(errorMessage(new Error('boom'))).toBe('boom');
		expect(errorMessage('plain')).toBe('plain');
		expect(errorMessage(new Error(''))).toBeUndefined();
		expect(errorMessage(undefined)).toBeUndefined();
		expect(errorMessage({ message: 'not an Error' })).toBeUndefined();
	});
});

describe('EmptyState', () => {
	test('renders title and description in the Empty composition', () => {
		const html = renderToString(
			<EmptyState title='Nothing yet' description='Add one to start' />,
		);
		expect(html).toContain('data-slot="empty"');
		expect(html).toContain('data-slot="empty-title"');
		expect(html).toContain('Nothing yet');
		expect(html).toContain('Add one to start');
	});

	test('bordered, small and error variants change the classes', () => {
		const plain = renderToString(<EmptyState title='x' />);
		const bordered = renderToString(<EmptyState title='x' bordered />);
		const small = renderToString(<EmptyState title='x' size='sm' />);
		const error = renderToString(<EmptyState title='x' tone='error' />);
		expect(plain).not.toContain('border ');
		expect(bordered).toContain('border');
		expect(small).toContain('p-4');
		expect(error).toContain('text-destructive');
	});

	test('omits the icon tile when no icon is given', () => {
		expect(renderToString(<EmptyState title='x' />)).not.toContain('empty-icon');
	});
});

describe('ErrorState', () => {
	test('shows the thrown message as description with error styling', () => {
		const html = renderToString(<ErrorState error={new Error('Network down')} />);
		expect(html).toContain('>Failed<'); // common:error.failed title
		expect(html).toContain('Network down');
		expect(html).toContain('text-destructive');
		expect(html).toContain('empty-icon'); // CircleAlert tile
	});

	test('still renders when the error has no readable message', () => {
		const html = renderToString(<ErrorState error={{ code: 500 }} />);
		expect(html).toContain('data-slot="empty"');
		expect(html).not.toContain('empty-description');
	});
});

describe('loading skeletons', () => {
	test('PageSkeleton renders cards and announces loading', () => {
		const html = renderToString(<PageSkeleton cards={2} lines={3} />);
		expect(html).toContain('aria-busy="true"');
		expect(html).toContain('sr-only');
		expect(html.match(/data-slot="card"/g)?.length).toBe(2);
		expect(html.match(/data-slot="skeleton"/g)?.length).toBe(2 + 2 + 2 * 3); // heading 2 + card titles 2 + lines
	});

	test('SectionSkeleton renders the requested number of lines', () => {
		const html = renderToString(<SectionSkeleton lines={4} />);
		expect(html.match(/data-slot="skeleton"/g)?.length).toBe(4);
	});
});
