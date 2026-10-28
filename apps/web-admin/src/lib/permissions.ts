/**
 * ERP permission names — must stay in sync with the backend
 * permission source (apps/backend-elysia)
 *
 * Format: `<resource>.<action>` (resource may contain dots).
 */
export const PERMISSIONS = {
  dashboard: ['view'],

  'crm.lead': ['view', 'create', 'update', 'delete'],
  'sales.quote': ['view', 'create', 'approve'],
  'sales.order': ['view', 'create', 'update'],
  'sales.invoice': ['view', 'create'],

  license: ['view', 'create', 'activate', 'renew', 'suspend'],

  'inventory.stock': ['view', 'receive', 'adjust'],
  'purchasing.purchase': ['view', 'create', 'approve'],

  assets: ['view', 'create', 'update', 'delete'],
  'projects.project': ['view', 'create', 'update'],
  'support.ticket': ['view', 'create', 'update', 'close'],

  'hr.employee': ['view', 'create', 'update'],
  'hr.attendance': ['view', 'create', 'approve'],
  payroll: ['view', 'prepare', 'approve', 'post'],

  'finance.account': ['view'],
  'finance.transaction': ['view', 'create', 'update', 'reverse'],
  'finance.reconciliation': ['execute'],
  'finance.report': ['view'],
  'finance.period': ['close'],

  'tax.configuration': ['view', 'update'],
  'tax.report': ['view'],

  investor: ['view', 'create', 'update'],
  'investor.distribution': ['approve'],
  'investor.payment': ['view'],

  reports: ['view', 'export'],

  users: ['view', 'create', 'update', 'disable'],
  roles: ['view', 'create', 'update', 'delete'],
  permissions: ['view'],
  audit: ['view'],

  'customer.portal': ['view'],
  'investor.portal': ['view'],
} as const;

export type PermissionResource = keyof typeof PERMISSIONS;

export type Permission = {
  [R in PermissionResource]: `${R}.${(typeof PERMISSIONS)[R][number]}`;
}[PermissionResource];
