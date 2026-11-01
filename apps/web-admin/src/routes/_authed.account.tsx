import { Outlet, createFileRoute, useLocation, useNavigate } from '@tanstack/react-router';
import { Tabs, TabsList, TabsTrigger } from '@ims-erp/ui/components/tabs';

/**
 * Account section layout: tabs over the child routes (`/account`,
 * `/account/email`, `/account/sessions`). The active tab tracks the
 * router location so tabs stay deep-linkable; clicking a tab navigates.
 */
export const Route = createFileRoute('/_authed/account')({
	component: AccountLayout,
});

const TABS = [
	{ value: '/account', label: 'Security' },
	{ value: '/account/email', label: 'Email' },
	{ value: '/account/sessions', label: 'Sessions' },
] as const;

function AccountLayout() {
	const location = useLocation();
	const navigate = useNavigate();
	const active =
		TABS.find((tab) =>
			// exact match first: `/account` must not shadow `/account/email`
			tab.value === location.pathname ? true : false,
		)?.value ??
		TABS.find((tab) => location.pathname.startsWith(tab.value))?.value ??
		'/account';

	return (
		<div className='mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 md:p-6'>
			<Tabs
				value={active}
				onValueChange={(value) => navigate({ to: value as string })}
			>
				<TabsList>
					{TABS.map((tab) => (
						<TabsTrigger key={tab.value} value={tab.value}>
							{tab.label}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			<Outlet />
		</div>
	);
}
