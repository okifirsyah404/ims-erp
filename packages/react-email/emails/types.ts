/**
 * Common shape for template props. The backend interpolates translations
 * via i18next before rendering (decision Q4): components receive final
 * strings only, so the preview server works without i18n resources and
 * components stay free of template-variable logic.
 */
export type EmailTexts = {
	/** Pre-translated greeting line, e.g. "Hi John,". */
	greeting: string;
	/** Pre-translated body paragraph. */
	body: string;
	/** Pre-translated CTA label. */
	action: string;
	/** Pre-translated copy-paste fallback lead-in. */
	fallback: string;
	/** Pre-translated no-reply footer line. */
	footer: string;
};
