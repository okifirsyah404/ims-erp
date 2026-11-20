import { useTranslation } from 'react-i18next';

/** Helpers of the website content editor (ERP-0071): field labels and the empty-value cleanup. */

/** Label of a registry field (`integrations:website.content.field.<key>`). */
export function useFieldLabel() {
	const { t } = useTranslation('integrations');
	return (key: string) => t(`website.content.field.${key}` as never) as string;
}

/** Drops empty strings, empty lists and empty groups (recursively) and trims text. */
export function cleanContent(value: unknown): unknown {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed === '' ? undefined : trimmed;
	}
	if (Array.isArray(value)) {
		const entries = value.map(cleanContent).filter((entry) => entry !== undefined);
		return entries.length === 0 ? undefined : entries;
	}
	if (value && typeof value === 'object') {
		const entries = Object.entries(value).flatMap(([key, entry]) => {
			const cleaned = cleanContent(entry);
			return cleaned === undefined ? [] : [[key, cleaned] as const];
		});
		return entries.length === 0 ? undefined : Object.fromEntries(entries);
	}
	return value ?? undefined;
}
