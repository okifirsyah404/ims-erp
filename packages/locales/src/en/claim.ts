/** Public invitation-claim page (`/invite/:token`) — no session required. */
const claim = {
	// Page-level states.
	'invalidTitle': 'Invitation not available',
	'invalid':
		'This invitation link is invalid, expired, or has already been used. Ask your administrator to send a new invitation.',
	'backToLogin': 'Back to sign in',

	// Claim form.
	'form.title': 'Set up your account',
	'form.description':
		'Hi {{name}} — this invitation is for {{email}}. Choose a username and password to finish setting up your account.',
	'form.username': 'Username',
	'form.usernameInvalid':
		'Use 3-30 letters, numbers or underscores.',
	'form.usernameAvailable': 'Username is available.',
	'form.usernameTaken': 'Username is already taken.',
	'form.password': 'Password',
	'form.passwordShort': 'Password must be at least 8 characters.',
	'form.phone': 'Phone number',
	'form.phoneInvalid': 'Enter a valid phone number.',
	'form.submit': 'Create account',
	'form.claiming': 'Creating account…',
} as const;

export default claim;
