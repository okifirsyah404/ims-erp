import admin from './admin';
import auth from './auth';
import common from './common';
import inventory from './inventory';
import nav from './nav';
import account from './account';
import api from './api';

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
	inventory,
	api,
} as const;

export type Namespace = keyof typeof en;
