import { describe, expect, test } from 'bun:test';
import {
	AppInvitationEmail,
	CodeEmail,
	OrganizationInvitationEmail,
	ResetPasswordEmail,
	renderEmail,
	VerificationEmail,
} from '../src';

const texts = {
	greeting: 'Hi John,',
	body: 'Welcome to IMS ERP.',
	action: 'Verify email',
	fallback: 'If the button does not work, copy and paste this link:',
	footer: 'Automated message from IMS ERP.',
};
const url = 'https://app.example.com/verify?token=abc123';

describe('email templates render', () => {
	test('code email shows the one-time code and the expiry (ERP-0022)', async () => {
		const { html, text } = await renderEmail(
			<CodeEmail code="482913" texts={{ greeting: 'Hi John,', body: 'Use this code.', expiry: 'Expires in 10 minutes.', footer: texts.footer }} />,
		);
		expect(html).toContain('482913');
		expect(html).toContain('Expires in 10 minutes.');
		expect(text).toContain('482913');
	});

	test('verification email contains CTA URL and copy', async () => {
		const { html, text } = await renderEmail(
			<VerificationEmail url={url} texts={texts} />,
		);
		expect(html).toContain(`href="${url}"`);
		expect(html).toContain('Verify email');
		expect(html).toContain('Hi John,');
		expect(text).toContain(url);
		expect(text.toUpperCase()).toContain('HI JOHN,');
	});

	test('reset password email contains CTA URL', async () => {
		const { html } = await renderEmail(
			<ResetPasswordEmail url={url} texts={{ ...texts, action: 'Reset password' }} />,
		);
		expect(html).toContain(`href="${url}"`);
		expect(html).toContain('Reset password');
	});

	test('app invitation email contains CTA URL and app body', async () => {
		const { html, text } = await renderEmail(
			<AppInvitationEmail
				url={url}
				texts={{
					...texts,
					action: 'Create account',
					body: 'You have been invited to create your account on Acme.',
				}}
			/>,
		);
		expect(html).toContain(`href="${url}"`);
		expect(html).toContain('Create account');
		expect(html).toContain('create your account on Acme');
		expect(html).not.toContain('join');
		expect(text).toContain(url);
	});

	test('organization invitation email contains intro, expiry and CTA URL', async () => {
		const { html, text } = await renderEmail(
			<OrganizationInvitationEmail
				intro="You have been invited to join Acme as Admin."
				expires="This invitation expires on 12 Jan 2026."
				url={url}
				texts={texts}
			/>,
		);
		expect(html).toContain(`href="${url}"`);
		expect(html).toContain('join Acme as Admin');
		expect(html).toContain('expires on 12 Jan 2026');
		expect(text).toContain(url);
	});

	test('plain-text version strips markup', async () => {
		const { text } = await renderEmail(
			<VerificationEmail url={url} texts={texts} />,
		);
		expect(text).not.toContain('<');
	});
});
