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
	ISupplierRepository,
} from '../contracts/procurement.repository.interface';
import type { PurchaseOrderService } from '../services/purchase-order.service';
import type { SupplierService } from '../services/supplier.service';
import type { IGoodsReceiptRepository } from '../contracts/goods-receipt.repository.interface';
import type { GoodsReceiptService } from '../services/goods-receipt.service';
import type { IPurchaseRequestRepository } from '../contracts/procurement.repository.interface';
import type { PurchaseRequestService } from '../services/purchase-request.service';

export const SUPPLIER_REPOSITORY_TOKEN: InjectionToken<ISupplierRepository> = Symbol('SUPPLIER_REPOSITORY');
export const SUPPLIER_SERVICE_TOKEN: InjectionToken<SupplierService> = Symbol('SUPPLIER_SERVICE');
export const PURCHASE_ORDER_REPOSITORY_TOKEN: InjectionToken<IPurchaseOrderRepository> = Symbol('PURCHASE_ORDER_REPOSITORY');
export const PURCHASE_ORDER_SERVICE_TOKEN: InjectionToken<PurchaseOrderService> = Symbol('PURCHASE_ORDER_SERVICE');
export const GOODS_RECEIPT_REPOSITORY_TOKEN: InjectionToken<IGoodsReceiptRepository> = Symbol('GOODS_RECEIPT_REPOSITORY');
export const GOODS_RECEIPT_SERVICE_TOKEN: InjectionToken<GoodsReceiptService> = Symbol('GOODS_RECEIPT_SERVICE');
export const PURCHASE_REQUEST_REPOSITORY_TOKEN: InjectionToken<IPurchaseRequestRepository> = Symbol('PURCHASE_REQUEST_REPOSITORY');
export const PURCHASE_REQUEST_SERVICE_TOKEN: InjectionToken<PurchaseRequestService> = Symbol('PURCHASE_REQUEST_SERVICE');
