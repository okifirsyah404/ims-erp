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

export const SUPPLIER_REPOSITORY_TOKEN: InjectionToken<ISupplierRepository> = Symbol('SUPPLIER_REPOSITORY');
export const SUPPLIER_SERVICE_TOKEN: InjectionToken<SupplierService> = Symbol('SUPPLIER_SERVICE');
export const PURCHASE_ORDER_REPOSITORY_TOKEN: InjectionToken<IPurchaseOrderRepository> = Symbol('PURCHASE_ORDER_REPOSITORY');
export const PURCHASE_ORDER_SERVICE_TOKEN: InjectionToken<PurchaseOrderService> = Symbol('PURCHASE_ORDER_SERVICE');
