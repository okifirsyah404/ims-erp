import { Link, useMatches } from '@tanstack/react-router';
import { Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@ims-erp/ui/components/breadcrumb';
import { myProjectQueryOptions } from '@/lib/project-api';
import { buildCrumbs } from './build-crumbs';

/**
 * Breadcrumb trail for the portal.
 *
 * @remarks
 * Two levels at most (section + page), so there is no ellipsis collapse here:
 * the admin needs one, a portal path never does.
 *
 * A project detail shows `Projects > <project title>`: the list crumb is
 * dropped (it would read "Projects > Projects") and the detail crumb takes the
 * title from `myProjectQueryOptions`, which is the same cache entry the page
 * fills — subscribing, not `getQueryData`, so the crumb updates when the title
 * lands instead of staying on the fallback label.
 */
export function AppBreadcrumb() {
	const matches = useMatches();
	const { t } = useTranslation('nav');
	const projectId = matches
		.map((match) => (match.params as Record<string, string | undefined>).projectId)
		.find((value): value is string => typeof value === 'string');
	const project = useQuery({
		...myProjectQueryOptions(projectId ?? ''),
		enabled: !!projectId,
	});

	const crumbs = buildCrumbs(matches, (key) => t(key))
		.map((crumb) =>
			crumb.href === '/projects/$projectId' && project.data?.title
				? { ...crumb, label: project.data.title }
				: crumb,
		)
		.filter((crumb, index, all) => {
			// "Projects > Projects" while the title loads: the parent list crumb
			// adds nothing when the child repeats its label.
			const child = all[index + 1];
			return !(child && child.label === crumb.label);
		});

	return (
		<Breadcrumb>
			<BreadcrumbList>
				{crumbs.map((crumb, index) => {
					const isLast = index === crumbs.length - 1;
					return (
						<Fragment key={crumb.key}>
							{index > 0 && <BreadcrumbSeparator />}
							<BreadcrumbItem>
								{isLast ? (
									<BreadcrumbPage>{crumb.label}</BreadcrumbPage>
								) : (
									<BreadcrumbLink render={<Link to={crumb.href ?? '/'} params={crumb.params} />}>
										{crumb.label}
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
						</Fragment>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
