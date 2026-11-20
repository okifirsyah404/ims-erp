import admin from './admin';
import assets from './assets';
import auth from './auth';
import common from './common';
import email from './email';
import dashboard from './dashboard';
import finance from './finance';
import inventory from './inventory';
import product from './product';
import warehouse from './warehouse';
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
import claim from './claim';
import integrations from './integrations';
import documents from './documents';
import notifications from './notifications';
import signatures from './signatures';

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
	product,
	warehouse,
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
	claim,
	integrations,
	documents,
	notifications,
	signatures,
} as const;

export type Namespace = keyof typeof en;
