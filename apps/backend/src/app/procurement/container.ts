import type { DependencyContainer } from 'tsyringe';
import { ExportedPurchaseOrderService } from './services/exported-purchase-order.service';
import {
	PURCHASE_ORDER_REPOSITORY_TOKEN,
	PURCHASE_ORDER_SERVICE_TOKEN,
	EXPORTED_PURCHASE_ORDER_SERVICE_TOKEN,
	PROCUREMENT_CODE_NUMBERING_REPOSITORY_TOKEN,
	PROCUREMENT_NUMBERING_SERVICE_TOKEN,
	GOODS_RECEIPT_REPOSITORY_TOKEN,
	GOODS_RECEIPT_SERVICE_TOKEN,
	PURCHASE_BILLING_SERVICE_TOKEN,
	PURCHASE_RETURN_REPOSITORY_TOKEN,
	PURCHASE_RETURN_SERVICE_TOKEN,
	PURCHASE_REQUEST_REPOSITORY_TOKEN,
	PURCHASE_REQUEST_SERVICE_TOKEN,
	PURCHASE_TERM_TEMPLATE_REPOSITORY_TOKEN,
	PURCHASE_TERM_TEMPLATE_SERVICE_TOKEN,
} from './constants/di';
import { PurchaseRequestRepository } from './repositories/purchase-request.repository';
import { PurchaseRequestService } from './services/purchase-request.service';
import { PurchaseOrderRepository } from './repositories/purchase-order.repository';
import { ProcurementCodeNumberingRepository } from './repositories/code-numbering.repository';
import { PurchaseOrderService } from './services/purchase-order.service';
import { ProcurementNumberingService } from './services/procurement-numbering.service';
import { GoodsReceiptRepository } from './repositories/goods-receipt.repository';
import { GoodsReceiptService } from './services/goods-receipt.service';
import { PurchaseBillingService } from './services/purchase-billing.service';
import { PurchaseReturnRepository } from './repositories/purchase-return.repository';
import { PurchaseReturnService } from './services/purchase-return.service';
import { PurchaseTermTemplateRepository } from './repositories/purchase-term-template.repository';
import { PurchaseTermTemplateService } from './services/purchase-term-template.service';

export * from './constants/di';

/** Registers the Procurement module's repositories and services. */
export function registerProcurement(container: DependencyContainer): void {
	container.register(PROCUREMENT_CODE_NUMBERING_REPOSITORY_TOKEN, { useClass: ProcurementCodeNumberingRepository });
	container.register(PROCUREMENT_NUMBERING_SERVICE_TOKEN, { useClass: ProcurementNumberingService });
	container.register(PURCHASE_ORDER_REPOSITORY_TOKEN, { useClass: PurchaseOrderRepository });
	container.register(PURCHASE_ORDER_SERVICE_TOKEN, { useClass: PurchaseOrderService });
	container.register(EXPORTED_PURCHASE_ORDER_SERVICE_TOKEN, { useClass: ExportedPurchaseOrderService });
	container.register(GOODS_RECEIPT_REPOSITORY_TOKEN, { useClass: GoodsReceiptRepository });
	container.register(GOODS_RECEIPT_SERVICE_TOKEN, { useClass: GoodsReceiptService });
	container.register(PURCHASE_BILLING_SERVICE_TOKEN, { useClass: PurchaseBillingService });
	container.register(PURCHASE_RETURN_REPOSITORY_TOKEN, { useClass: PurchaseReturnRepository });
	container.register(PURCHASE_RETURN_SERVICE_TOKEN, { useClass: PurchaseReturnService });
	container.register(PURCHASE_REQUEST_REPOSITORY_TOKEN, { useClass: PurchaseRequestRepository });
	container.register(PURCHASE_REQUEST_SERVICE_TOKEN, { useClass: PurchaseRequestService });
	container.register(PURCHASE_TERM_TEMPLATE_REPOSITORY_TOKEN, { useClass: PurchaseTermTemplateRepository });
	container.register(PURCHASE_TERM_TEMPLATE_SERVICE_TOKEN, { useClass: PurchaseTermTemplateService });
}
