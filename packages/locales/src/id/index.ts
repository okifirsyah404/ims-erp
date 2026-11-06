import admin_ from './admin';
import assets_ from './assets';
import auth_ from './auth';
import common_ from './common';
import dashboard_ from './dashboard';
import inventory_ from './inventory';
import nav_ from './nav';
import account_ from './account';
import api_ from './api';
import tax_ from './tax';

/** Indonesian resources — same namespace/key shape as `en`. */
export const id = {
	common: common_,
	nav: nav_,
	auth: auth_,
	account: account_,
	admin: admin_,
	assets: assets_,
	inventory: inventory_,
	dashboard: dashboard_,
	api: api_,
	tax: tax_,
} as const;
