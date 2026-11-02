'use client';

import { ChevronRight, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { NavKey } from '@ims-erp/locales';

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

export function NavMain({
	items,
}: {
	/** `title` values are keys in the `nav` namespace. */
	items: {
		title: NavKey;
		url: string;
		icon?: LucideIcon;
		isActive?: boolean;
		items?: {
			title: NavKey;
			url: string;
		}[];
	}[];
}) {
	const { t } = useTranslation('nav');

	return (
		<SidebarGroup>
			<SidebarGroupLabel>{t('section.platform')}</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => {
					const title = t(item.title);
					return (
						<Collapsible
							key={item.title}
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
										<SidebarMenuSubItem key={subItem.title}>
											<SidebarMenuSubButton href={subItem.url}>
												<span>{t(subItem.title)}</span>
											</SidebarMenuSubButton>
										</SidebarMenuSubItem>
									))}
								</SidebarMenuSub>
							</CollapsibleContent>
						</Collapsible>
					);
				})}
			</SidebarMenu>
		</SidebarGroup>
	);
}
