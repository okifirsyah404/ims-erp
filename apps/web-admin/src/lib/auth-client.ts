import { createAuthClient } from 'better-auth/react'
import { adminClient, organizationClient } from 'better-auth/client/plugins'
import { currentLanguage } from '@/i18n'
import { erpAccessControl, erpRoles } from './erp-ac'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  basePath: '/api/auth',
  fetchOptions: {
    credentials: 'include',
    onRequest: (context) => {
      /**
       * The backend runs Better Auth's `i18n` plugin with header detection, so
       * `Accept-Language` decides which locale its error messages come back in.
       * Resolved per request (not once at module load) — switching language
       * must take effect on the very next call.
       */
      context.headers.set('Accept-Language', currentLanguage());
    },
  },
  plugins: [
    adminClient(),
    // organizationClient mirrors the server's organization() plugin
    // configuration (same ac + roles from the shared catalog).
    organizationClient({
      ac: erpAccessControl,
      roles: erpRoles,
    }),
  ],
});

export const { signIn, signOut, useSession, getSession, organization } =
  authClient;

/** Requests a password-reset email; `redirectTo` is the reset page URL. */
export const requestPasswordReset = authClient.requestPasswordReset;
/** Sets a new password using the token from the reset link. */
export const resetPassword = authClient.resetPassword;
