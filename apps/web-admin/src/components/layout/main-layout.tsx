import { Separator } from '@ims-erp/ui/components/separator';
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from '@ims-erp/ui/components/sidebar';
import { AppBreadcrumb } from './app-breadcrumb';
import { AppSidebar } from '../sidebar/main-sidebar';

export default function MainLayout({ children }: React.ComponentProps<'div'>) {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className='flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12'>
					<div className='flex items-center gap-2 px-4'>
						<SidebarTrigger className='-ml-1' />
						<Separator
							orientation='vertical'
							className='mr-2 data-[orientation=vertical]:h-4'
						/>
						<AppBreadcrumb />
					</div>
				</header>
				<main className='flex flex-1 flex-col gap-4 p-4 pt-0 md:gap-6 md:p-6'>
					{children}
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}

