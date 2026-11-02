import { container } from 'tsyringe';
import {
	districtQuerySchema,
	provinceQuerySchema,
	regencyQuerySchema,
	villageQuerySchema,
} from '../contracts/location.contract';
import { LOCATION_SERVICE_TOKEN } from '../constants/di';
import { LocationService } from '../services/location.service';
import { translator } from '@providers/i18n/translator';
import { domainPlugin } from '@http/plugin';
import { errorEnvelope, ok, okPaginated } from '@http/response';

/**
 * REST controller exposing read-only location selection endpoints.
 *
 * @remarks
 * Layered architecture boundary: this class owns HTTP concerns only -
 * query parsing, envelope mapping, status mapping - and delegates all
 * business logic to {@link LocationService}. The service is resolved
 * from the tsyringe container here (the HTTP boundary), never deeper.
 * These endpoints are public reference data: no authentication is
 * required. Absent-or-soft-deleted records map to `404`. All responses
 * use the `TApiResponse` / `TApiPaginatedResponse` envelope from
 * `@ims-erp/common`.
 *
 * @throws 400 When query/path parameters fail validation
 * @throws 404 When an id-targeted lookup finds no alive row
 */
export class LocationController {
	/**
	 * Builds the Elysia plugin mounting all location routes.
	 *
	 * @remarks
	 * Resolves {@link LocationService} from the tsyringe container once at
	 * plugin build time. Validation failures are mapped to a 400 envelope by
	 * the shared {@link domainPlugin} error hook; domain errors are not
	 * expected here since lookups simply return `404`.
	 *
	 * @returns An Elysia instance with the `/locations` route group mounted
	 */
	static plugin() {
		const locationService = container.resolve<LocationService>(
			LOCATION_SERVICE_TOKEN,
		);

		return domainPlugin({
			name: 'location',
			prefix: '/locations',
			tags: ['Location'],
		})
			.get(
				'/provinces',
				async ({ query }) =>
					okPaginated(
						await locationService.paginateProvinces(
							provinceQuerySchema.parse(query),
						),
					),
			)
			.get('/provinces/:id', async (ctx) => {
				const { params, status } = ctx;
				const row = await locationService.getProvince(params.id);
				if (!row) {
					const t = translator(ctx);
					return status(
						404,
						errorEnvelope(404, t('common.notFound'), [
							{ message: t('location.provinceNotFound') },
						]),
					);
				}
				return ok(row);
			})
			.get(
				'/regencies',
				async ({ query }) =>
					okPaginated(
						await locationService.paginateRegencies(
							regencyQuerySchema.parse(query),
						),
					),
			)
			.get('/regencies/:id', async (ctx) => {
				const { params, status } = ctx;
				const row = await locationService.getRegency(params.id);
				if (!row) {
					const t = translator(ctx);
					return status(
						404,
						errorEnvelope(404, t('common.notFound'), [
							{ message: t('location.regencyNotFound') },
						]),
					);
				}
				return ok(row);
			})
			.get(
				'/districts',
				async ({ query }) =>
					okPaginated(
						await locationService.paginateDistricts(
							districtQuerySchema.parse(query),
						),
					),
			)
			.get('/districts/:id', async (ctx) => {
				const { params, status } = ctx;
				const row = await locationService.getDistrict(params.id);
				if (!row) {
					const t = translator(ctx);
					return status(
						404,
						errorEnvelope(404, t('common.notFound'), [
							{ message: t('location.districtNotFound') },
						]),
					);
				}
				return ok(row);
			})
			.get(
				'/regencies/:id/districts',
				async ({ params }) =>
					ok(await locationService.getDistrictsByRegency(params.id)),
			)
			.get(
				'/villages',
				async ({ query }) =>
					okPaginated(
						await locationService.paginateVillages(
							villageQuerySchema.parse(query),
						),
					),
			)
			.get('/villages/:id', async (ctx) => {
				const { params, status } = ctx;
				const row = await locationService.getVillage(params.id);
				if (!row) {
					const t = translator(ctx);
					return status(
						404,
						errorEnvelope(404, t('common.notFound'), [
							{ message: t('location.villageNotFound') },
						]),
					);
				}
				return ok(row);
			})
			.get(
				'/districts/:id/villages',
				async ({ params }) =>
					ok(await locationService.getVillagesByDistrict(params.id)),
			);
	}
}
