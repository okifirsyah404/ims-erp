import { queryOptions } from '@tanstack/react-query';
import { authClient } from './auth-client';
import { queryClient } from './query-client';

/**
 * Sign-in methods linked to the current user (Better Auth `listAccounts`,
 * ERP-0111). `providerId` is `credential` for the email/password login and
 * the provider id (`google`) for social logins.
 */
export type TLinkedAccount = {
	id: string;
	providerId: string;
	accountId: string;
	createdAt: Date | string;
};

/** Social providers the account page offers to connect. */
export const SOCIAL_PROVIDERS = ['google'] as const;
export type TSocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export const linkedAccountsQueryOptions = queryOptions({
	queryKey: ['auth', 'accounts'] as const,
	queryFn: async (): Promise<TLinkedAccount[]> => {
		const { data, error } = await authClient.listAccounts();
		if (error) throw new Error(error.message ?? 'Failed to load accounts');
		return (data ?? []) as TLinkedAccount[];
	},
});

export const invalidateLinkedAccounts = () =>
	queryClient.invalidateQueries({ queryKey: linkedAccountsQueryOptions.queryKey });

/** Whether the user has an email/password login. */
export function hasCredential(accounts: readonly TLinkedAccount[]): boolean {
	return accounts.some((account) => account.providerId === 'credential');
}
