import { apiKey } from '@better-auth/api-key';
import { BetterAuthPlugin } from 'better-auth';

export const betterAuthApiKeyPlugin: BetterAuthPlugin =
  apiKey() as BetterAuthPlugin;
