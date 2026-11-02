import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent } from '@ims-erp/ui/components/card';
import { useSession } from '@/lib/auth-client';

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

	if (isPending) return null;
	if (session?.user?.role !== 'admin') {
		return (
			<Card>
				<CardContent className='py-8 text-center text-sm text-muted-foreground'>
					{t('inventory:adminOnly')}
				</CardContent>
			</Card>
		);
	}
	return <>{children}</>;
}
