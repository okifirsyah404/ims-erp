import { Toaster } from '@/components/toast';
import { NotFound } from '@/components/not-found';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';

const RootLayout = () => (
	<>
		<Outlet />
		<Toaster />
		<TanStackRouterDevtools position='bottom-right' />
	</>
);

export const Route = createRootRoute({
	component: RootLayout,
	notFoundComponent: NotFound,
});
