import { createAuthClient } from 'better-auth/react'
import { adminClient, organizationClient } from 'better-auth/client/plugins'
import { erpAccessControl, erpRoles } from './erp-ac'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  basePath: '/api/auth',
  fetchOptions: {
    credentials: 'include',
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
