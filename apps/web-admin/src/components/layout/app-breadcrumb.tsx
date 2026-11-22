import { Link, useMatches, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import {
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@ims-erp/ui/components/breadcrumb';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@ims-erp/ui/components/dropdown-menu';
import { productQueryOptions } from '@/lib/inventory-api';
import { organizationMembersQueryOptions, organizationQueryOptions } from '@/lib/organization-api';
import { buildCrumbs, collapseCrumbs } from './build-crumbs';

const MAX_VISIBLE = 4;

/**
 * Derives the breadcrumb trail from the router's matched routes. Dynamic
 * segments are enriched with display names from the TanStack Query cache
 * (no extra requests) and fall back to the raw id while data is missing.
 */
export function AppBreadcrumb() {
	const matches = useMatches();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { t } = useTranslation('nav');

	const enrich = (fullPath: string, params: Record<string, string | undefined>) => {
		const organizationId = params.organizationId;
		if (fullPath === '/organizations/$organizationId' && organizationId) {
			const organization = queryClient.getQueryData(
				organizationQueryOptions(organizationId).queryKey,
			);
			if (organization?.name) return organization.name;
		}
		const memberId = params.memberId;
		if (
			fullPath === '/organizations/$organizationId/members/$memberId/edit' &&
			organizationId &&
			memberId
		) {
			const members = queryClient.getQueryData(
				organizationMembersQueryOptions(organizationId).queryKey,
			);
			const member = members?.rows.find((row) => row.id === memberId);
			if (member?.user?.name) return member.user.name;
		}
		// Item detail (`/products|components|materials/$productId`): show the name.
		const productId = params.productId;
		if (productId && fullPath.endsWith('/$productId')) {
			const product = queryClient.getQueryData(productQueryOptions(productId).queryKey);
			if (product?.name) return product.name;
		}
		return undefined;
	};

	const routeExists = (template: string) => Object.hasOwn(router.routesByPath, template);

	const crumbs = collapseCrumbs(buildCrumbs(matches, t, enrich, routeExists), MAX_VISIBLE);

	return (
		<Breadcrumb>
			<BreadcrumbList>
				{crumbs.shown.map((crumb, index) => {
					const isFirst = index === 0;
					const isLast = index === crumbs.shown.length - 1;
					return (
						<Fragment key={crumb.key}>
							{!isFirst && <BreadcrumbSeparator className='hidden md:block' />}
							{crumb.href === null ? (
								<BreadcrumbItem>
									<BreadcrumbPage>{crumb.label}</BreadcrumbPage>
								</BreadcrumbItem>
							) : (
								<BreadcrumbItem className={isLast ? undefined : 'hidden md:block'}>
									<BreadcrumbLink render={<Link to={crumb.href} params={crumb.params} />}>
										{crumb.label}
									</BreadcrumbLink>
								</BreadcrumbItem>
							)}
							{isFirst && crumbs.hidden.length > 0 && (
								<>
									<BreadcrumbSeparator className='hidden md:block' />
									<BreadcrumbItem className='hidden md:block'>
										<DropdownMenu>
											<DropdownMenuTrigger className='flex size-5 items-center justify-center text-muted-foreground hover:text-foreground'>
												<BreadcrumbEllipsis />
											</DropdownMenuTrigger>
											<DropdownMenuContent align='start'>
												{crumbs.hidden.map((hidden) => (
													<DropdownMenuItem
														key={hidden.key}
														render={<Link to={hidden.href ?? '/'} params={hidden.params} />}
													>
														{hidden.label}
													</DropdownMenuItem>
												))}
											</DropdownMenuContent>
										</DropdownMenu>
									</BreadcrumbItem>
								</>
							)}
						</Fragment>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
