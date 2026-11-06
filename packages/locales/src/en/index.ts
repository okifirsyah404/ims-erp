import admin from './admin';
import assets from './assets';
import auth from './auth';
import common from './common';
import dashboard from './dashboard';
import inventory from './inventory';
import nav from './nav';
import account from './account';
import api from './api';
import settings from './settings';
import crm from './crm';
import sales from './sales';
import finance from './finance';
import procurement from './procurement';
import projects from './projects';
import licensing from './licensing';

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
	dashboard,
	api,
	settings,
	crm,
	sales,
	finance,
	procurement,
	projects,
	licensing,
} as const;

export type Namespace = keyof typeof en;
