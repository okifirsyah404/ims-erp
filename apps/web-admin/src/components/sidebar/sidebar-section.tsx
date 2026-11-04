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
import { useTranslation } from 'react-i18next';
import type { NavKey } from '@ims-erp/locales';
import type { SidebarItem } from './sidebar-item';
import { Link } from '@tanstack/react-router';

export default function SidebarSection({
	labelKey,
	items,
}: {
	/** Key in the `nav` namespace for the section heading. */
	labelKey: NavKey;
	items: SidebarItem[];
}) {
	const { t } = useTranslation('nav');

	return (
		<SidebarGroup>
			<SidebarGroupLabel>{t(labelKey)}</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => {
					const title = t(item.titleKey);
					if (item.items) {
						return (
							<Collapsible
								key={item.titleKey}
								render={<SidebarMenuItem />}
								defaultOpen={item.isActive}
								className='group/collapsible'
							>
								<CollapsibleTrigger
									render={<SidebarMenuButton tooltip={title} />}
								>
									{item.icon && <item.icon />}
									<span>{title}</span>
									<ChevronRight className='ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90' />
								</CollapsibleTrigger>
								<CollapsibleContent>
									<SidebarMenuSub>
										{item.items?.map((subItem) => (
											<SidebarMenuSubItem key={subItem.titleKey}>
												<SidebarMenuSubButton
													render={
														<Link
															to={subItem.url}
															activeProps={{ 'data-active': true }}
														/>
													}
												>
													<span>{t(subItem.titleKey)}</span>
												</SidebarMenuSubButton>
											</SidebarMenuSubItem>
										))}
									</SidebarMenuSub>
								</CollapsibleContent>
							</Collapsible>
						);
					}

					return (
						<SidebarMenuItem key={item.titleKey}>
							<SidebarMenuButton
								tooltip={title}
								render={
									item.url === '#' ? undefined : (
										<Link to={item.url} activeProps={{ 'data-active': true }} />
									)
								}
							>
								{item.icon && <item.icon />}
								<span>{title}</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					);
				})}
			</SidebarMenu>
		</SidebarGroup>
	);
}
