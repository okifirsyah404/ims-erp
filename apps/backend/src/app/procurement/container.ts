import type { DependencyContainer } from 'tsyringe';
import {
	PURCHASE_ORDER_REPOSITORY_TOKEN,
	PURCHASE_ORDER_SERVICE_TOKEN,
	SUPPLIER_REPOSITORY_TOKEN,
	SUPPLIER_SERVICE_TOKEN,
} from './constants/di';
import { PurchaseOrderRepository } from './repositories/purchase-order.repository';
import { SupplierRepository } from './repositories/supplier.repository';
import { PurchaseOrderService } from './services/purchase-order.service';
import { SupplierService } from './services/supplier.service';

export * from './constants/di';

/** Registers the Procurement module's repositories and services. */
export function registerProcurement(container: DependencyContainer): void {
	container.register(SUPPLIER_REPOSITORY_TOKEN, { useClass: SupplierRepository });
	container.register(SUPPLIER_SERVICE_TOKEN, { useClass: SupplierService });
	container.register(PURCHASE_ORDER_REPOSITORY_TOKEN, { useClass: PurchaseOrderRepository });
	container.register(PURCHASE_ORDER_SERVICE_TOKEN, { useClass: PurchaseOrderService });
}
