import { username } from 'better-auth/plugins/username';

export const betterAuthUsernamePlugin = username({
	// Alphanumeric + underscore, 3-30 chars (library defaults).
	usernameValidator: undefined,
});
