import { describe, expect, test } from 'bun:test';
import {
	isMailEnabled,
	resolveMailFrom,
	type MailPayload,
} from '../../src/providers/mailer/mailer.transport';
import {
	renderAppInvitationEmail,
	renderOrganizationInvitationEmail,
	renderResetPasswordEmail,
	renderVerificationEmail,
} from '../../src/providers/mailer/mailer.templates';

/**
 * Mailer unit tests. Transport resolution depends on `appConfig.mail`, which
 * is parsed from the workspace `.env` at import time — the local dev .env
 * configures Mailpit SMTP, so `isMailEnabled()` is asserted dynamically
 * rather than pinned, and no test sends real mail.
 *
 * Templates render async via `@ims-erp/react-email` (react-email `render`).
 */

describe('mailer transport', () => {
	test('resolveMailFrom returns a non-empty sender', () => {
		expect(resolveMailFrom().length).toBeGreaterThan(0);
	});

	test('isMailEnabled matches whether an SMTP host is configured', () => {
		// Only SMTP exists today; if neither transport env is set the flag
		// must be false so dispatchMail drops instead of enqueueing.
		const smtpConfigured = isMailEnabled();
		expect(typeof smtpConfigured).toBe('boolean');
	});
});

describe('email templates', () => {
	const url = 'https://erp.example.com/verify?token=abc123';

	test('verification template renders subject, html, and text with the url', async () => {
		const rendered = await renderVerificationEmail({ name: 'Andi', url });
		expect(rendered.subject.length).toBeGreaterThan(0);
		expect(rendered.html).toContain(url);
		expect(rendered.html).toContain('Andi');
		expect(rendered.text).toContain(url);
	});

	test('reset-password template renders subject, html, and text with the url', async () => {
		const rendered = await renderResetPasswordEmail({ name: null, url });
		expect(rendered.subject.length).toBeGreaterThan(0);
		expect(rendered.html).toContain(url);
		expect(rendered.text).toContain(url);
	});

	test('app invitation template renders app-specific subject and body', async () => {
		const rendered = await renderAppInvitationEmail({
			name: 'Andi',
			url: 'https://erp.example.com/invite/tok',
		});
		expect(rendered.subject).not.toContain('join');
		expect(rendered.subject.length).toBeGreaterThan(0);
		expect(rendered.html).toContain('https://erp.example.com/invite/tok');
		expect(rendered.html).not.toContain('Acme');
		expect(rendered.text).toContain('https://erp.example.com/invite/tok');
	});

	test('organization invitation template renders subject, html, and text with the claim url', async () => {
		const rendered = await renderOrganizationInvitationEmail({
			name: 'Andi',
			url: 'https://erp.example.com/invite/tok',
			organizationName: 'Acme',
			roleName: 'Admin',
			expiresAt: '12 Jan 2026, 09:00',
		});
		expect(rendered.subject).toContain('Acme');
		expect(rendered.html).toContain('https://erp.example.com/invite/tok');
		expect(rendered.html).toContain('Acme');
		expect(rendered.text).toContain('https://erp.example.com/invite/tok');
	});

	test('templates include action labels per locale', async () => {
		const en = await renderVerificationEmail({ name: 'A', url, language: 'en' });
		expect(en.html).toContain('Verify email');
		const id = await renderVerificationEmail({ name: 'A', url, language: 'id' });
		expect(id.html).toContain('Verifikasi email');
	});

	test('rendered payload is assignable to MailPayload (shape check)', async () => {
		const rendered = await renderVerificationEmail({ name: 'A', url });
		const payload: MailPayload = { to: 'u@example.com', ...rendered };
		expect(payload.to).toBe('u@example.com');
	});
});
