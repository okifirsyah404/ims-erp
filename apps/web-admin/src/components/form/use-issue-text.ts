import { useTranslation } from 'react-i18next';

import type { TFieldIssue } from '@/lib/form-validation';

/**
 * Returns a function that words a field issue with the field's label
 * (message pattern 4.5: "Nama wajib diisi.").
 *
 * @remarks
 * Issues carrying a shared key are translated in the UI language with the
 * label; an issue with only a server message falls back to that message.
 * `example` switches "not valid" to "not valid. Example: …".
 */
export function useIssueText() {
	const { t } = useTranslation('common');
	return (issue: TFieldIssue | undefined, label: string, example?: string): string | null => {
		if (!issue) return null;
		if (!issue.key) return issue.message ?? null;
		if (issue.key === 'invalidFormat' && example) {
			return t('formError.invalidFormatExample', { label, example });
		}
		// The key is composed from the shared vocabulary; every composed key
		// exists in both bundles (locale parity + dead-key prefix `formError.`).
		const options = { label, min: '', max: '', other: '', value: '', remaining: '', ...issue.params };
		const translate = t as unknown as (key: string, values: object) => string;
		return translate(`formError.${issue.key}`, options);
	};
}
