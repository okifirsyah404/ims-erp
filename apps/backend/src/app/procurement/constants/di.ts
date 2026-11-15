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
import type { PurchaseBillingService } from '../services/purchase-billing.service';

export const SUPPLIER_REPOSITORY_TOKEN: InjectionToken<ISupplierRepository> = Symbol('SUPPLIER_REPOSITORY');
export const SUPPLIER_SERVICE_TOKEN: InjectionToken<SupplierService> = Symbol('SUPPLIER_SERVICE');
export const PURCHASE_ORDER_REPOSITORY_TOKEN: InjectionToken<IPurchaseOrderRepository> = Symbol('PURCHASE_ORDER_REPOSITORY');
export const PURCHASE_ORDER_SERVICE_TOKEN: InjectionToken<PurchaseOrderService> = Symbol('PURCHASE_ORDER_SERVICE');
export const GOODS_RECEIPT_REPOSITORY_TOKEN: InjectionToken<IGoodsReceiptRepository> = Symbol('GOODS_RECEIPT_REPOSITORY');
export const GOODS_RECEIPT_SERVICE_TOKEN: InjectionToken<GoodsReceiptService> = Symbol('GOODS_RECEIPT_SERVICE');
/** Exported contract for Finance's supplier bills (ERP-0012). */
export const PURCHASE_BILLING_SERVICE_TOKEN: InjectionToken<PurchaseBillingService> = Symbol('PURCHASE_BILLING_SERVICE');
