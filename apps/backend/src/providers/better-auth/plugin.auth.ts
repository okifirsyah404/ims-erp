import { BetterAuthPlugin } from 'better-auth';
import { betterAuthAdminPlugin } from './plugins/admin.auth.js';
import { betterAuthApiKeyPlugin } from './plugins/api-key.auth.js';
import { betterAuthEmailOTPPlugin } from './plugins/email-otp.auth.js';
import { betterAuthI18nPlugin } from './plugins/i18n.auth.js';
import { betterAuthMagicLinkPlugin } from './plugins/magic-link.auth.js';
import { betterAuthMultiSessionPlugin } from './plugins/multi-session.auth.js';
import { betterAuthOpenAPIPlugin } from './plugins/open-api.auth.js';
import { betterAuthOrganizationPlugin } from './plugins/organization.auth.js';

import { betterAuthPasskeyPlugin } from './plugins/passkey.auth.js';
import { betterAuthUsernamePlugin } from './plugins/username.auth.js';
import { betterAuthEmailIdentifierPlugin } from './plugins/identifier.auth.js';
import { betterAuthLastLoginMethodPlugin } from './plugins/last-login-method.auth.js';

export const betterAuthPlugins = [
  betterAuthOpenAPIPlugin,
  betterAuthAdminPlugin,
  betterAuthOrganizationPlugin,
  betterAuthUsernamePlugin,
  betterAuthEmailIdentifierPlugin,
  betterAuthMultiSessionPlugin,
  betterAuthEmailOTPPlugin,
  betterAuthPasskeyPlugin,
  betterAuthMagicLinkPlugin,
  betterAuthApiKeyPlugin,
  betterAuthLastLoginMethodPlugin,
  betterAuthI18nPlugin,
] as const satisfies BetterAuthPlugin[];
