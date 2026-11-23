import { useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ConnectedAccountsCard } from '@/components/account/connected-accounts-card';
import { EmailCard } from '@/components/account/email-card';
import { PasswordCard } from '@/components/account/password-card';
import { SessionsTable } from '@/components/account/sessions-table';
import { UsernameCard } from '@/components/account/username-card';
import { PayslipsCard } from '@/components/account/payslips-card';
import { invalidateLinkedAccounts } from '@/lib/account-api';
import {
	accountsSearchSchema,
	linkOutcome,
	verificationOutcome,
} from '@/lib/account-search';
import { invalidateSelfUser } from '@/lib/user-api';

/**
 * Account settings (`/accounts`, ERP-0111): one page of stacked cards in
 * place of the former `/account`, `/account/email` and `/account/sessions`
 * tabs. Each card's DOM id is its `section` value, so `?section=email`
 * scrolls to it.
 */
export const Route = createFileRoute('/_authed/accounts')({
	validateSearch: accountsSearchSchema,
	component: AccountsPage,
});

function AccountsPage() {
	const { t } = useTranslation('account');
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });

	// Read the Better Auth return parameters once: they are cleared from the
	// URL right after, but the result stays on screen.
	const [returned] = useState(() => ({
		section: search.section,
		verification: verificationOutcome(search),
		link: linkOutcome(search),
	}));

	useEffect(() => {
		const { section, verification, link } = returned;
		if (verification === 'verified') void invalidateSelfUser();
		if (link === 'linked') void invalidateLinkedAccounts();
		if (!section && !verification && !link) return;
		// Clear the params without the router's scroll reset (it would cancel
		// the scroll below), then bring the requested card into view.
		void navigate({ search: {}, replace: true, resetScroll: false }).then(() => {
			if (!section) return;
			requestAnimationFrame(() =>
				document
					.getElementById(section)
					?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
			);
		});
	}, [returned, navigate]);

	return (
		<div className='mx-auto flex w-full max-w-2xl flex-col gap-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('page.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('page.description')}</p>
			</div>
			<UsernameCard id='username' />
			<EmailCard id='email' outcome={returned.verification} />
			<ConnectedAccountsCard id='connected' outcome={returned.link} />
			<PasswordCard id='password' />
			<SessionsTable id='sessions' />
			<PayslipsCard id='payslips' />
		</div>
	);
}
