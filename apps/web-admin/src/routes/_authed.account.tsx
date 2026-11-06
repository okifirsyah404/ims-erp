import { Outlet, createFileRoute, useLocation, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { AccountKey } from '@ims-erp/locales';
import { Tabs, TabsList, TabsTrigger } from '@ims-erp/ui/components/tabs';

/**
 * Account section layout: tabs over the child routes (`/account`,
 * `/account/email`, `/account/sessions`). The active tab tracks the
 * router location so tabs stay deep-linkable; clicking a tab navigates.
 */
export const Route = createFileRoute('/_authed/account')({
	component: AccountLayout,
});

/** `labelKey` is an `account` namespace key, resolved at render time. */
const TABS = [
	{ value: '/account', labelKey: 'tab.security' },
	{ value: '/account/email', labelKey: 'tab.email' },
	{ value: '/account/sessions', labelKey: 'tab.sessions' },
] as const satisfies ReadonlyArray<{ value: string; labelKey: AccountKey }>;

function AccountLayout() {
	const location = useLocation();
	const navigate = useNavigate();
	const { t } = useTranslation('account');
	const active =
		TABS.find((tab) =>
			// exact match first: `/account` must not shadow `/account/email`
			tab.value === location.pathname ? true : false,
		)?.value ??
		TABS.find((tab) => location.pathname.startsWith(tab.value))?.value ??
		'/account';

	return (
		<div className='mx-auto flex w-full max-w-2xl flex-col gap-4'>
			<Tabs
				value={active}
				onValueChange={(value) => navigate({ to: value as string })}
			>
				<TabsList>
					{TABS.map((tab) => (
						<TabsTrigger key={tab.value} value={tab.value}>
							{t(tab.labelKey)}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			<Outlet />
		</div>
	);
}
