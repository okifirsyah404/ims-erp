import {
	DEFAULT_LANGUAGE,
	en,
	id,
	type LanguageCode,
} from '@ims-erp/locales';
import { createInstance } from 'i18next';
import { appConfig } from '@config/providers/config';
import type { MailPayload } from './mailer.transport';

/**
 * Email HTML templates rendered through the `email` namespace of
 * `@ims-erp/locales`.
 *
 * Better Auth hooks run outside the Elysia request lifecycle (no request-
 * scoped `t`), so a standalone i18next instance is built here — the same
 * resource bundles and fallback the Elysia plugin uses. Language is a
 * parameter defaulting to {@link DEFAULT_LANGUAGE}; pass the user's locale
 * once it is stored on the user record.
 */

const appName = () => appConfig.app.name ?? 'ERP';

type EmailKey = keyof typeof en.email & string;

function t(
	language: LanguageCode,
	key: `email:${EmailKey}`,
	options?: Record<string, unknown>,
): string {
	const instance = createInstance();
	instance.init({
		lng: language,
		fallbackLng: DEFAULT_LANGUAGE,
		supportedLngs: ['en', 'id'],
		keySeparator: false,
		nsSeparator: ':',
		interpolation: { escapeValue: false },
		resources: { en, id } as never,
	});
	return instance.t(key, options ?? {}) as string;
}

/** Minimal, client-safe HTML wrapper. Inline styles — email clients strip <style>. */
function wrap(content: string): string {
	return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a2e;">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
${content}
</div>
</body></html>`;
}

function actionButton(url: string, label: string): string {
	return `<p style="margin:24px 0;"><a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">${label}</a></p>`;
}

function fallbackParagraph(url: string, fallbackText: string): string {
	return `<p style="margin:16px 0;font-size:13px;color:#6b7280;word-break:break-all;">${fallbackText}<br><a href="${url}">${url}</a></p>`;
}

function footer(language: LanguageCode): string {
	return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
<p style="margin:0;font-size:12px;color:#9ca3af;">${t(language, 'email:footer.noReply', { app: appName() })}</p>`;
}

type TemplateInput = {
	name?: string | null;
	url: string;
	language?: LanguageCode;
};

/** Verification-email subject + HTML body. */
export function renderVerificationEmail({
	name,
	url,
	language = DEFAULT_LANGUAGE,
}: TemplateInput): Omit<MailPayload, 'to'> {
	return {
		subject: t(language, 'email:verification.subject'),
		html: wrap(
			`<p style="margin:0 0 16px;font-size:16px;">${t(language, 'email:verification.greeting', { name: name ?? '' })}</p>
<p style="margin:0 0 8px;font-size:14px;line-height:1.6;">${t(language, 'email:verification.body', { app: appName() })}</p>
${actionButton(url, t(language, 'email:verification.action'))}
${fallbackParagraph(url, t(language, 'email:verification.fallback'))}
${footer(language)}`,
		),
		text: `${t(language, 'email:verification.greeting', { name: name ?? '' })}\n\n${t(language, 'email:verification.body', { app: appName() })}\n\n${url}`,
	};
}

/** Password-reset-email subject + HTML body. */
export function renderResetPasswordEmail({
	name,
	url,
	language = DEFAULT_LANGUAGE,
}: TemplateInput): Omit<MailPayload, 'to'> {
	return {
		subject: t(language, 'email:resetPassword.subject'),
		html: wrap(
			`<p style="margin:0 0 16px;font-size:16px;">${t(language, 'email:resetPassword.greeting', { name: name ?? '' })}</p>
<p style="margin:0 0 8px;font-size:14px;line-height:1.6;">${t(language, 'email:resetPassword.body', { app: appName() })}</p>
${actionButton(url, t(language, 'email:resetPassword.action'))}
${fallbackParagraph(url, t(language, 'email:resetPassword.fallback'))}
${footer(language)}`,
		),
		text: `${t(language, 'email:resetPassword.greeting', { name: name ?? '' })}\n\n${t(language, 'email:resetPassword.body', { app: appName() })}\n\n${url}`,
	};
}
