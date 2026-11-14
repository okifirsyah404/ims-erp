import admin_ from './admin';
import assets_ from './assets';
import auth_ from './auth';
import common_ from './common';
import email_ from './email';
import dashboard_ from './dashboard';
import finance_ from './finance';
import inventory_ from './inventory';
import nav_ from './nav';
import account_ from './account';
import api_ from './api';
import settings_ from './settings';
import crm_ from './crm';
import sales_ from './sales';
import procurement_ from './procurement';
import projects_ from './projects';
import licensing_ from './licensing';
import tax_ from './tax';
import hr_ from './hr';
import claim_ from './claim';
import documents_ from './documents';
import notifications_ from './notifications';

/** Indonesian resources — same namespace/key shape as `en`. */
export const id = {
	common: common_,
	email: email_,
	nav: nav_,
	auth: auth_,
	account: account_,
	admin: admin_,
	assets: assets_,
	inventory: inventory_,
	finance: finance_,
	dashboard: dashboard_,
	api: api_,
	settings: settings_,
	crm: crm_,
	sales: sales_,
	procurement: procurement_,
	projects: projects_,
	licensing: licensing_,
	tax: tax_,
	hr: hr_,
	claim: claim_,
	documents: documents_,
	notifications: notifications_,
} as const;
