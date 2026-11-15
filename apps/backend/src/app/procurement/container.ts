import type { DependencyContainer } from 'tsyringe';
import {
	PURCHASE_ORDER_REPOSITORY_TOKEN,
	PURCHASE_ORDER_SERVICE_TOKEN,
	SUPPLIER_REPOSITORY_TOKEN,
	SUPPLIER_SERVICE_TOKEN,
	GOODS_RECEIPT_REPOSITORY_TOKEN,
	GOODS_RECEIPT_SERVICE_TOKEN,
	PURCHASE_BILLING_SERVICE_TOKEN,
} from './constants/di';
import { PurchaseOrderRepository } from './repositories/purchase-order.repository';
import { SupplierRepository } from './repositories/supplier.repository';
import { PurchaseOrderService } from './services/purchase-order.service';
import { SupplierService } from './services/supplier.service';
import { GoodsReceiptRepository } from './repositories/goods-receipt.repository';
import { GoodsReceiptService } from './services/goods-receipt.service';
import { PurchaseBillingService } from './services/purchase-billing.service';

export * from './constants/di';

/** Registers the Procurement module's repositories and services. */
export function registerProcurement(container: DependencyContainer): void {
	container.register(SUPPLIER_REPOSITORY_TOKEN, { useClass: SupplierRepository });
	container.register(SUPPLIER_SERVICE_TOKEN, { useClass: SupplierService });
	container.register(PURCHASE_ORDER_REPOSITORY_TOKEN, { useClass: PurchaseOrderRepository });
	container.register(PURCHASE_ORDER_SERVICE_TOKEN, { useClass: PurchaseOrderService });
	container.register(GOODS_RECEIPT_REPOSITORY_TOKEN, { useClass: GoodsReceiptRepository });
	container.register(GOODS_RECEIPT_SERVICE_TOKEN, { useClass: GoodsReceiptService });
	container.register(PURCHASE_BILLING_SERVICE_TOKEN, { useClass: PurchaseBillingService });
}
