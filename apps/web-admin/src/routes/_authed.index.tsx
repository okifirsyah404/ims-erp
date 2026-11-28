import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@ims-erp/ui/components/empty';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { hasInternalRole } from '@/lib/internal-role';
import { myOrganizationsQueryOptions } from '@/lib/organization-api';
import { useIsAppAdmin } from '@/lib/use-is-app-admin';

/**
 * Shown on `/` to a caller with no internal organization role.
 *
 * @remarks
 * A platform admin without membership has no ERP access (ADR-0006); they
 * become an organization's owner by creating it, so they are pointed at the
 * organizations page. Everyone else is told to ask for an invitation.
 */
function NoDashboardAccess({ isAppAdmin }: { isAppAdmin: boolean }) {
	const { t } = useTranslation(['dashboard', 'nav']);
	return (
		<Empty className='flex-1'>
			<EmptyHeader>
				<EmptyMedia variant='icon'>
					<ShieldAlert />
				</EmptyMedia>
				<EmptyTitle>{t('gate.title')}</EmptyTitle>
				<EmptyDescription>
					{t(isAppAdmin ? 'gate.appAdmin' : 'gate.noRole')}
				</EmptyDescription>
			</EmptyHeader>
			{isAppAdmin && (
				<EmptyContent>
					<Link
						to='/settings/organizations'
						className='inline-flex h-8 items-center rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted'
					>
						{t('nav:organization.manage')}
					</Link>
				</EmptyContent>
			)}
		</Empty>
	);
}

/**
 * `/` renders the Dashboard only for users with an internal role. Others get
 * an explanation, not a redirect: a redirect to `/` from `/` would loop (see
 * `canOpenPath`).
 */
function DashboardGate() {
	const { data, isPending } = useQuery(myOrganizationsQueryOptions);
	const { isAppAdmin, isPending: sessionPending } = useIsAppAdmin();
	if (isPending || sessionPending) return null;
	const allowed = (data ?? []).some((org) => hasInternalRole(org.role));
	return allowed ? <DashboardPage /> : <NoDashboardAccess isAppAdmin={isAppAdmin} />;
}

export const Route = createFileRoute('/_authed/')({
	component: DashboardGate,
});
