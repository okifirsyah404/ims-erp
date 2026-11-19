/**
 * Injection tokens of the Procurement module (ADR-0011 step 4).
 *
 * @remarks
 * `SUPPLIER_SERVICE_TOKEN` and `PURCHASE_ORDER_SERVICE_TOKEN` are the
 * module's exported contracts (goods receipts and finance use them later).
 */
import type { InjectionToken } from 'tsyringe';
import type {
	IPurchaseOrderRepository,
} from '../contracts/procurement.repository.interface';
import type { PurchaseOrderService } from '../services/purchase-order.service';
import type { ProcurementCodeNumberingRepository } from '../repositories/code-numbering.repository';
import type { ProcurementNumberingService } from '../services/procurement-numbering.service';
import type { IGoodsReceiptRepository } from '../contracts/goods-receipt.repository.interface';
import type { GoodsReceiptService } from '../services/goods-receipt.service';
import type { PurchaseBillingService } from '../services/purchase-billing.service';
import type { IPurchaseReturnRepository } from '../contracts/purchase-return.repository.interface';
import type { PurchaseReturnService } from '../services/purchase-return.service';
import type { IPurchaseRequestRepository } from '../contracts/procurement.repository.interface';
import type { PurchaseRequestService } from '../services/purchase-request.service';

export const PROCUREMENT_CODE_NUMBERING_REPOSITORY_TOKEN: InjectionToken<ProcurementCodeNumberingRepository> = Symbol('PROCUREMENT_CODE_NUMBERING_REPOSITORY');
export const PROCUREMENT_NUMBERING_SERVICE_TOKEN: InjectionToken<ProcurementNumberingService> = Symbol('PROCUREMENT_NUMBERING_SERVICE');
export const PURCHASE_ORDER_REPOSITORY_TOKEN: InjectionToken<IPurchaseOrderRepository> = Symbol('PURCHASE_ORDER_REPOSITORY');
export const PURCHASE_ORDER_SERVICE_TOKEN: InjectionToken<PurchaseOrderService> = Symbol('PURCHASE_ORDER_SERVICE');
export const GOODS_RECEIPT_REPOSITORY_TOKEN: InjectionToken<IGoodsReceiptRepository> = Symbol('GOODS_RECEIPT_REPOSITORY');
export const GOODS_RECEIPT_SERVICE_TOKEN: InjectionToken<GoodsReceiptService> = Symbol('GOODS_RECEIPT_SERVICE');
/** Exported contract for Finance's supplier bills (ERP-0012). */
export const PURCHASE_BILLING_SERVICE_TOKEN: InjectionToken<PurchaseBillingService> = Symbol('PURCHASE_BILLING_SERVICE');
export const PURCHASE_RETURN_REPOSITORY_TOKEN: InjectionToken<IPurchaseReturnRepository> = Symbol('PURCHASE_RETURN_REPOSITORY');
export const PURCHASE_RETURN_SERVICE_TOKEN: InjectionToken<PurchaseReturnService> = Symbol('PURCHASE_RETURN_SERVICE');
export const PURCHASE_REQUEST_REPOSITORY_TOKEN: InjectionToken<IPurchaseRequestRepository> = Symbol('PURCHASE_REQUEST_REPOSITORY');
export const PURCHASE_REQUEST_SERVICE_TOKEN: InjectionToken<PurchaseRequestService> = Symbol('PURCHASE_REQUEST_SERVICE');
