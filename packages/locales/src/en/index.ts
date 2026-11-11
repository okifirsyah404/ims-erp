import admin from './admin';
import assets from './assets';
import auth from './auth';
import common from './common';
import email from './email';
import dashboard from './dashboard';
import finance from './finance';
import inventory from './inventory';
import nav from './nav';
import account from './account';
import api from './api';
import settings from './settings';
import crm from './crm';
import sales from './sales';
import procurement from './procurement';
import projects from './projects';
import licensing from './licensing';
import tax from './tax';
import hr from './hr';

/**
 * English resources, grouped by namespace. This bundle is the source of
 * truth: every other locale must mirror these key sets exactly.
 */
export const en = {
	common,
	email,
	nav,
	auth,
	account,
	admin,
	assets,
	inventory,
	finance,
	dashboard,
	api,
	settings,
	crm,
	sales,
	procurement,
	projects,
	licensing,
	tax,
	hr,
} as const;

export type Namespace = keyof typeof en;
