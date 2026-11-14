import { Separator } from '@ims-erp/ui/components/separator';
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from '@ims-erp/ui/components/sidebar';
import { NotificationBell } from '@/components/notification/notification-bell';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { AppBreadcrumb } from './app-breadcrumb';
import { AppSidebar } from '../sidebar/main-sidebar';
import { NavUser } from '../sidebar/nav-user';

export default function MainLayout({ children }: React.ComponentProps<'div'>) {
	// One socket for the whole authenticated shell; unmounting it (sign-out)
	// closes the connection.
	useRealtime();

	return (
		<SidebarProvider>
			{/* Printed documents show only the page content. */}
			<div className='contents print:hidden'>
				<AppSidebar />
			</div>
			<SidebarInset>
				<header className='sticky top-0 z-10 flex h-16 print:hidden shrink-0 items-center justify-between gap-2 border-b bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12'>
					<div className='flex items-center gap-2 px-4'>
						<SidebarTrigger className='-ml-1' />
						<Separator
							orientation='vertical'
							className='mr-2 data-[orientation=vertical]:h-4'
						/>
						<AppBreadcrumb />
					</div>
					<div className='flex items-center gap-1 px-4'>
						<NotificationBell />
						<NavUser />
					</div>
				</header>
				<main className='flex flex-1 flex-col gap-4 p-4 pt-0 md:gap-6 md:p-6 print:p-0'>
					{children}
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}

