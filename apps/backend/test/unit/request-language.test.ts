/**
 * End-to-end check that API messages follow `Accept-Language`.
 *
 * @remarks
 * Mounts a real controller (not a mock) through the same i18next plugin
 * wiring as `src/index.ts`, then asserts the response envelope's `message`
 * and `errors[].message` in each case. This is the only test that exercises
 * the plugin's language detection — unit tests of the services cannot, since
 * they have no request.
 */
import { describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { i18next } from 'elysia-i18next';
import { createInstance } from 'i18next';
import { container } from 'tsyringe';
import {
	DEFAULT_LANGUAGE,
	LANGUAGE_CODES,
	en,
	id as idBundle,
} from '@ims-erp/locales';
import { LocationController } from '../../src/app/location/controllers/location.controller';
import type { LocationService } from '../../src/app/location/services/location.service';
import { LOCATION_SERVICE_TOKEN } from '../../src/app/location/constants/di';

/**
 * Registers a stub location service whose lookups all miss.
 *
 * @remarks
 * The endpoints under test only need "row not found" to reach the 404 path
 * that carries the translatable message, so every method resolves `null`.
 */
function registerStubService() {
	const miss = () => Promise.resolve(null);
	container.register(LOCATION_SERVICE_TOKEN, {
		useValue: {
			getProvince: miss,
			getRegency: miss,
			getDistrict: miss,
			getVillage: miss,
		} as unknown as LocationService,
	});
}

/**
 * Builds the app under test, mirroring `src/index.ts`.
 *
 * @remarks
 * The `elysia-i18next` declarations target a different Elysia version, so the
 * plugin is cast at mount time — exactly as the real bootstrap does. Type
 * safety for call sites comes from the `translator` helper instead.
 */
function makeApp() {
	registerStubService();
	const instance = createInstance();
	const plugin = i18next({
		instance,
		initOptions: {
			fallbackLng: DEFAULT_LANGUAGE,
			supportedLngs: [...LANGUAGE_CODES],
			keySeparator: false,
			nsSeparator: ':',
			interpolation: { escapeValue: false },
			resources: { en, id: idBundle } as never,
		},
	}) as unknown as (app: Elysia) => Elysia;

	return new Elysia().use(plugin).use(LocationController.plugin());
}

/** Fetches `path`, returning the parsed body of the error envelope. */
async function getMessage(path: string, headers: Record<string, string> = {}) {
	const app = makeApp();
	const response = await app.handle(
		new Request(`http://localhost${path}`, { headers }),
	);
	const body = (await response.json()) as {
		message: string;
		errors?: { message: string }[];
	};
	return { status: response.status, body };
}

describe('Accept-Language', () => {
	test('absent header yields English', async () => {
		const { status, body } = await getMessage('/locations/provinces/missing');
		expect(status).toBe(404);
		expect(body.message).toBe('Not found');
		expect(body.errors?.[0]?.message).toBe('Province not found');
	});

	test('id yields Indonesian', async () => {
		const { status, body } = await getMessage('/locations/provinces/missing', {
			'accept-language': 'id',
		});
		expect(status).toBe(404);
		expect(body.message).toBe('Tidak ditemukan');
		expect(body.errors?.[0]?.message).toBe('Provinsi tidak ditemukan');
	});

	test('weighted browser header picks the first supported language', async () => {
		const { body } = await getMessage('/locations/provinces/missing', {
			'accept-language': 'id-ID,id;q=0.9,en;q=0.8',
		});
		expect(body.errors?.[0]?.message).toBe('Provinsi tidak ditemukan');
	});

	test('regional subtag falls back to its primary language', async () => {
		const { body } = await getMessage('/locations/villages/missing', {
			'accept-language': 'id-ID',
		});
		expect(body.errors?.[0]?.message).toBe('Kelurahan/desa tidak ditemukan');
	});

	test('unsupported language falls back to English', async () => {
		const { body } = await getMessage('/locations/regencies/missing', {
			'accept-language': 'fr-FR,fr;q=0.9',
		});
		expect(body.errors?.[0]?.message).toBe('Regency not found');
	});
});
