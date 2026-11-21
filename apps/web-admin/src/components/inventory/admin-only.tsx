import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { hasRole } from '@ims-erp/common';
import { useSession } from '@/lib/auth-client';
import { EmptyState } from '@/components/empty-state';
import { ShieldAlert } from 'lucide-react';
import { PageSkeleton } from '@/components/page-skeleton';

/**
 * Renders its children only for application administrators.
 *
 * @remarks
 * UX only — never a security boundary. The backend refuses every inventory
 * call from a non-admin on its own; this just avoids rendering a screen that
 * would only produce 403s. It mirrors the sidebar gate in
 * `nav-inventory.tsx`, which keys off the same `user.role === 'admin'` fact.
 *
 * The name is deliberate: `admin` here is the **platform** role, not an
 * organization role. Organization administrators have no inventory screen.
 */
export function AdminOnly({ children }: { children: ReactNode }) {
	const { t } = useTranslation(['inventory']);
	const { data: session, isPending } = useSession();

	if (isPending) return <PageSkeleton />;
	if (!hasRole(session?.user?.role, 'admin')) {
		return (
			<EmptyState icon={ShieldAlert} title={t('inventory:adminOnly')} bordered />
		);
	}
	return <>{children}</>;
}
