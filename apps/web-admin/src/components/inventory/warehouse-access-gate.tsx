import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent } from '@ims-erp/ui/components/card';
import { useWarehouseAccess } from '@/lib/use-warehouse-access';

/**
 * Renders its children for application administrators and for warehouse
 * persons in charge (ADR-0017).
 *
 * @remarks
 * UX only — never a security boundary. The backend answers 403/404 per route;
 * this just avoids rendering a screen that can only fail. A person in charge
 * gets here through `inventory.warehouse_managers`, which is neither an
 * organization role nor a permission, so the plain `<AdminOnly>` gate is too
 * narrow for these routes.
 */
export function WarehouseAccessGate({ children }: { children: ReactNode }) {
	const { t } = useTranslation(['inventory']);
	const { canAccess, isPending } = useWarehouseAccess();

	if (isPending) return null;
	if (!canAccess) {
		return (
			<Card>
				<CardContent className='py-8 text-center text-sm text-muted-foreground'>
					{t('inventory:warehouses.noAccess')}
				</CardContent>
			</Card>
		);
	}
	return <>{children}</>;
}
