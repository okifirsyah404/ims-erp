import { Outlet, createFileRoute, useLocation, useNavigate } from '@tanstack/react-router';
import { Tabs, TabsList, TabsTrigger } from '@ims-erp/ui/components/tabs';

/**
 * Profiles section layout: tabs over the child routes (`/profiles` and
 * `/profiles/edit`). The active tab tracks the router location so tabs
 * stay deep-linkable; clicking a tab navigates.
 */
export const Route = createFileRoute('/_authed/profiles')({
	component: ProfilesLayout,
});

const TABS = [
	{ value: '/profiles', label: 'Profile' },
	{ value: '/profiles/edit', label: 'Edit' },
] as const;

function ProfilesLayout() {
	const location = useLocation();
	const navigate = useNavigate();
	const active =
		TABS.find((tab) => location.pathname.startsWith(tab.value))?.value ??
		'/profiles';

	return (
		<div className='mx-auto flex w-full max-w-2xl flex-col gap-4'>
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
