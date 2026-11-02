import admin_ from './admin';
import auth_ from './auth';
import common_ from './common';
import nav_ from './nav';
import account_ from './account';
import api_ from './api';

/** Indonesian resources — same namespace/key shape as `en`. */
export const id = {
	common: common_,
	nav: nav_,
	auth: auth_,
	account: account_,
	admin: admin_,
	api: api_,
} as const;
