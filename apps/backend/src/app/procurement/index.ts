/**
 * Public entry point of the Procurement module: composition-root
 * registration, the HTTP controllers, and the exported services.
 */
export { registerProcurement } from './container';
export { PurchaseOrderController } from './controllers/purchase-order.controller';
export { SupplierController } from './controllers/supplier.controller';
export { GoodsReceiptController } from './controllers/goods-receipt.controller';
export { PURCHASE_ORDER_SERVICE_TOKEN, SUPPLIER_SERVICE_TOKEN } from './constants/di';
