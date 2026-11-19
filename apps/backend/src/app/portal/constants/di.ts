import type { InjectionToken } from 'tsyringe';
import type { IPortalSessionGateway } from '../contracts/portal.contract';
import type { PortalAuthService } from '../services/portal-auth.service';
import type { PortalService } from '../services/portal.service';
import type { PortalSalesService } from '../services/portal-sales.service';

/** Injection tokens of the customer portal module (ERP-0022). */
export const PORTAL_SESSION_GATEWAY_TOKEN: InjectionToken<IPortalSessionGateway> = Symbol('PORTAL_SESSION_GATEWAY');
export const PORTAL_AUTH_SERVICE_TOKEN: InjectionToken<PortalAuthService> = Symbol('PORTAL_AUTH_SERVICE');
export const PORTAL_SERVICE_TOKEN: InjectionToken<PortalService> = Symbol('PORTAL_SERVICE');
/** Ordering, quotations, orders, invoices and payment for the signed-in customer (ERP-0070). */
export const PORTAL_SALES_SERVICE_TOKEN: InjectionToken<PortalSalesService> = Symbol('PORTAL_SALES_SERVICE');
