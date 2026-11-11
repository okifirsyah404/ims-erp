/** Transactional emails (verification, password reset) sent by the backend. */
const email = {
	'verification.subject': 'Verify your email address',
	'verification.greeting': 'Hi {{name}},',
	'verification.body':
		'Welcome to {{app}}. Please confirm your email address by clicking the button below. The link expires when your verification request does.',
	'verification.action': 'Verify email',
	'verification.fallback':
		'If the button does not work, copy and paste this link into your browser:',

	'resetPassword.subject': 'Reset your password',
	'resetPassword.greeting': 'Hi {{name}},',
	'resetPassword.body':
		'We received a request to reset the password for your {{app}} account. Click the button below to choose a new password. If you did not request this, you can safely ignore this email.',
	'resetPassword.action': 'Reset password',
	'resetPassword.fallback':
		'If the button does not work, copy and paste this link into your browser:',

	// App invitation (invitation.type = 'app'): invite to create an account
	// on the application itself — no organization context.
	'appInvitation.subject': "You're invited to create your {{app}} account",
	'appInvitation.greeting': 'Hi {{name}},',
	'appInvitation.body':
		'You have been invited to create your account on {{app}}. Accept the invitation to set up your account and get started.',
	'appInvitation.action': 'Create account',
	'appInvitation.fallback':
		'If the button does not work, copy and paste this link into your browser:',

	// Organization invitation (invitation.type = 'org'): invite to join a
	// specific organization with a role.
	'organizationInvitation.subject': 'You are invited to join {{organization}}',
	'organizationInvitation.greeting': 'Hi {{name}},',
	'organizationInvitation.intro':
		'You have been invited to join {{organization}} on {{app}} as {{role}}. Accept the invitation to create your account and start collaborating.',
	'organizationInvitation.expires': 'This invitation expires on {{expiresAt}}.',
	'organizationInvitation.action': 'Accept invitation',
	'organizationInvitation.fallback':
		'If the button does not work, copy and paste this link into your browser:',

	'footer.noReply':
		'This is an automated message from {{app}}; replies to this address are not monitored.',
} as const;

export default email;
