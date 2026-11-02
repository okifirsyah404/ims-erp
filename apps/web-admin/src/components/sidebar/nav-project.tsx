'use client';

import {
	Folder,
	Forward,
	MoreHorizontal,
	Trash2,
	type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@ims-erp/ui/components/dropdown-menu';
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from '@ims-erp/ui/components/sidebar';

export function NavProjects({
	projects,
}: {
	projects: {
		name: string;
		url: string;
		icon: LucideIcon;
	}[];
}) {
	const { isMobile } = useSidebar();
	const { t } = useTranslation('nav');

	return (
		<SidebarGroup className='group-data-[collapsible=icon]:hidden'>
			<SidebarGroupLabel>{t('project.projects')}</SidebarGroupLabel>
			<SidebarMenu>
				{projects.map((item) => (
					<SidebarMenuItem key={item.name}>
						<SidebarMenuButton render={<a href={item.url} />}>
							<item.icon />
							<span>{item.name}</span>
						</SidebarMenuButton>
						<DropdownMenu>
							<DropdownMenuTrigger render={<SidebarMenuAction showOnHover />}>
								<MoreHorizontal />
								<span className='sr-only'>{t('project.more')}</span>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className='w-48 rounded-lg'
								side={isMobile ? 'bottom' : 'right'}
								align={isMobile ? 'end' : 'start'}
							>
								<DropdownMenuItem>
									<Folder className='text-muted-foreground' />
									<span>{t('project.view')}</span>
								</DropdownMenuItem>
								<DropdownMenuItem>
									<Forward className='text-muted-foreground' />
									<span>{t('project.share')}</span>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem>
									<Trash2 className='text-muted-foreground' />
									<span>{t('project.delete')}</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				))}
				<SidebarMenuItem>
					<SidebarMenuButton className='text-sidebar-foreground/70'>
						<MoreHorizontal className='text-sidebar-foreground/70' />
						<span>{t('project.more')}</span>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		</SidebarGroup>
	);
}
