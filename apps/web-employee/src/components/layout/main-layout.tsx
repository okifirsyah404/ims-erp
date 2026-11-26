import { Separator } from '@ims-erp/ui/components/separator';
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from '@ims-erp/ui/components/sidebar';
import { NotificationBell } from '@/components/notification/notification-bell';
import { OrganizationContextSync } from '@/components/organization/organization-context-sync';
import { PortalBottomBar } from '@/components/sidebar/portal-bottom-bar';
import { PortalSidebar } from '@/components/sidebar/portal-sidebar';
import { NavUser } from '@/components/sidebar/nav-user';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { AppBreadcrumb } from './app-breadcrumb';

/**
 * Portal shell.
 *
 * @remarks
 * Same structure as web-admin's shell (one realtime socket, the organization
 * sync, a sticky header), with two portal-specific changes:
 * - the sidebar rail is hidden below `md`; the bottom bar takes over there;
 * - `<main>` reserves room for that bar so the last card is never covered.
 */
export default function MainLayout({ children }: React.ComponentProps<'div'>) {
	useRealtime();

	return (
		<SidebarProvider>
			<OrganizationContextSync />
			<div className='contents print:hidden md:block'>
				<PortalSidebar />
			</div>
			<SidebarInset className='min-w-0'>
				<header className='sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background md:h-16 print:hidden'>
					<div className='flex items-center gap-2 px-4'>
						<SidebarTrigger className='-ml-1 hidden md:inline-flex' />
						<Separator
							orientation='vertical'
							className='mr-2 hidden data-[orientation=vertical]:h-4 md:block'
						/>
						<AppBreadcrumb />
					</div>
					<div className='flex items-center gap-1 px-4'>
						<NotificationBell />
						<NavUser />
					</div>
				</header>
				<main className='flex flex-1 flex-col gap-4 p-4 pb-24 md:gap-6 md:p-6 md:pb-6 print:p-0'>
					{children}
				</main>
			</SidebarInset>
			<PortalBottomBar />
		</SidebarProvider>
	);
}
