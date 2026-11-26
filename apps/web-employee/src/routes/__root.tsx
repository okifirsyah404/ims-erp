import { ConfirmProvider } from '@/components/confirm-dialog';
import { Toaster } from '@/components/toast';
import { NotFound } from '@/components/not-found';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';

const RootLayout = () => (
	<ConfirmProvider>
		<Outlet />
		<Toaster />
		<TanStackRouterDevtools position='bottom-right' />
	</ConfirmProvider>
);

export const Route = createRootRoute({
	component: RootLayout,
	notFoundComponent: NotFound,
});
