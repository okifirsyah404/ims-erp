import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@ims-erp/ui/components/collapsible';
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from '@ims-erp/ui/components/sidebar';
import { ChevronRight } from 'lucide-react';
import type { SidebarItem } from './sidebar-item';
import { Link } from '@tanstack/react-router';

export default function SidebarSection({
	label,
	items,
}: {
	label: string;
	items: SidebarItem[];
}) {
	return (
		<SidebarGroup>
			<SidebarGroupLabel>{label}</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => {
					if (item.items) {
						return (
							<Collapsible
								key={item.title}
								render={<SidebarMenuItem />}
								defaultOpen={item.isActive}
								className='group/collapsible'
							>
								<CollapsibleTrigger
									render={<SidebarMenuButton tooltip={item.title} />}
								>
									{item.icon && <item.icon />}
									<span>{item.title}</span>
									<ChevronRight className='ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90' />
								</CollapsibleTrigger>
								<CollapsibleContent>
									<SidebarMenuSub>
										{item.items?.map((subItem) => (
											<SidebarMenuSubItem key={subItem.title}>
												<SidebarMenuSubButton href={subItem.url}>
													<span>{subItem.title}</span>
												</SidebarMenuSubButton>
											</SidebarMenuSubItem>
										))}
									</SidebarMenuSub>
								</CollapsibleContent>
							</Collapsible>
						);
					}

					return (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton
								tooltip={item.title}
								render={
									item.url === '#' ? undefined : (
										<Link to={item.url} activeProps={{ 'data-active': true }} />
									)
								}
							>
								{item.icon && <item.icon />}
								<span>{item.title}</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					);
				})}
			</SidebarMenu>
		</SidebarGroup>
	);
}
