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

	'footer.noReply':
		'This is an automated message from {{app}}; replies to this address are not monitored.',
} as const;

export default email;
