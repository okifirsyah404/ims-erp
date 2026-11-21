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

	// Customer portal invitation (ERP-0022): the link sets the first password
	// on the customer portal.
	'portalInvitation.subject': 'Your {{app}} customer portal account',
	'portalInvitation.greeting': 'Hi {{name}},',
	'portalInvitation.body':
		'An account has been created for you on the {{app}} customer portal, where you can follow your projects, warranties and service tickets. Set your password to sign in. The link expires in 3 days.',
	'portalInvitation.action': 'Set password',
	'portalInvitation.fallback':
		'If the button does not work, copy and paste this link into your browser:',

	// Customer portal sign-up code (ERP-0022): verifies the email of an
	// individual who signed up.
	'portalSignupCode.subject': '{{code}} is your {{app}} portal code',
	'portalSignupCode.greeting': 'Hi {{name}},',
	'portalSignupCode.body': 'Use this code to finish creating your {{app}} customer portal account.',
	'portalSignupCode.expiry': 'The code expires in 10 minutes. If you did not sign up, ignore this email.',

	// Customer portal two-step sign-in code (ERP-0106): sent after a correct
	// password when the login has two-step sign-in on.
	'portalLoginCode.subject': '{{code}} is your {{app}} sign-in code',
	'portalLoginCode.greeting': 'Hi {{name}},',
	'portalLoginCode.body': 'Use this code to finish signing in to your {{app}} customer portal account.',
	'portalLoginCode.expiry': 'The code expires in 10 minutes. If you did not try to sign in, change your password now.',

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
