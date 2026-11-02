/** Login, forgot-password and reset-password flows. */
const auth = {
	'login.title': 'Welcome back',
	'login.subtitle': 'Login to your Entragate ERP account',
	'login.identifier': 'Email or username',
	'login.identifierPlaceholder': 'm@example.com or johndoe',
	// Still used by the forgot-password form (email-only flow).
	'login.email': 'Email',
	'login.emailPlaceholder': 'm@example.com',
	'login.password': 'Password',
	'login.forgotPassword': 'Forgot your password?',
	'login.submit': 'Login',
	'login.submitting': 'Signing in…',
	'login.invalidCredentials': 'Invalid email/username or password',
	'login.orContinueWith': 'Or continue with',
	'login.googleSignIn': 'Sign in with Google',

	'forgot.title': 'Forgot your password?',
	'forgot.subtitle': "Enter your email and we'll send you a reset link",
	'forgot.sent': 'If an account exists for that email, a password reset link has been sent. Check your inbox.',
	'forgot.submit': 'Send reset link',
	'forgot.submitting': 'Sending…',
	'forgot.backToLogin': 'Back to login',

	'reset.title': 'Reset your password',
	'reset.subtitle': 'Choose a new password for your account',
	'reset.newPassword': 'New password',
	'reset.confirmPassword': 'Confirm password',
	'reset.passwordHint': 'At least 8 characters.',
	'reset.submit': 'Reset password',
	'reset.submitting': 'Resetting…',
	'reset.requestNewLink': 'Request a new reset link',
	'reset.mismatch': 'Passwords do not match',
	'reset.invalidLink': 'Invalid or expired reset link',
} as const;

export default auth;
