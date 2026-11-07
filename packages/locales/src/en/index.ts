import admin from './admin';
import assets from './assets';
import auth from './auth';
import common from './common';
import dashboard from './dashboard';
import finance from './finance';
import inventory from './inventory';
import nav from './nav';
import account from './account';
import api from './api';
import tax from './tax';

/**
 * English resources, grouped by namespace. This bundle is the source of
 * truth: every other locale must mirror these key sets exactly.
 */
export const en = {
	common,
	nav,
	auth,
	account,
	admin,
	assets,
	inventory,
	finance,
	dashboard,
	api,
	tax,
} as const;

export type Namespace = keyof typeof en;
