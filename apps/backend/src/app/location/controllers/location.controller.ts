import { Elysia } from 'elysia';
import { ZodError } from 'zod';
import { container } from 'tsyringe';
import type {
	TApiErrorMessage,
	TApiResponse,
	TApiPaginatedResponse,
} from '@ims-erp/common';
import type { TPaginationResult } from '@ims-erp/common';
import {
	districtQuerySchema,
	provinceQuerySchema,
	regencyQuerySchema,
	villageQuerySchema,
} from '../contracts/location.contract';
import { LOCATION_SERVICE_TOKEN } from '../constants/di';
import { LocationService } from '../services/location.service';

/**
 * Builds the response envelope metadata shared by all location endpoints.
 */
function buildMeta(status: number, message: string) {
	return {
		requestId: crypto.randomUUID(),
		status,
		message,
		timestamp: Date.now(),
	};
}

/**
 * Wraps a single row in the standard API response envelope.
 */
function ok<T>(data: T): TApiResponse<T> {
	return { ...buildMeta(200, 'OK'), data };
}

/**
 * Wraps a paginated result in the standard API paginated envelope.
 */
function okPaginated<T>(
	result: TPaginationResult<T>,
): TApiPaginatedResponse<T> {
	return {
		...buildMeta(200, 'OK'),
		pagination: result.meta,
		data: result.data,
	};
}

/**
 * Builds the standard error envelope for a failed request.
 */
function errorEnvelope(
	status: number,
	message: string,
	errors: TApiErrorMessage[],
): TApiResponse<null> {
	return { ...buildMeta(status, message), errors, data: null };
}

/**
 * REST controller exposing read-only location selection endpoints.
 *
 * @remarks
 * Layered architecture boundary: this class owns HTTP concerns only —
 * query parsing, envelope mapping, status mapping — and delegates all
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
	 */
	static plugin() {
		const locationService = container.resolve<LocationService>(
			LOCATION_SERVICE_TOKEN,
		);

		return new Elysia({
			prefix: '/locations',
			name: 'location',
			tags: ['Location'],
		})
			.onError({ as: 'local' }, ({ code, error, set }) => {
				if (code === 'VALIDATION') {
					set.status = 400;
					return errorEnvelope(400, 'Validation failed', [
						{ field: error.value ? String(error.value) : null, message: error.message },
					]);
				}
				if (code === 'PARSE' || error instanceof ZodError) {
					set.status = 400;
					return errorEnvelope(400, 'Validation failed', [
						{ field: null, message: String(error) },
					]);
				}
				return undefined;
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
			.get('/provinces/:id', async ({ params, status }) => {
				const row = await locationService.getProvince(params.id);
				if (!row) {
					return status(
						404,
						errorEnvelope(404, 'Not found', [
							{ message: 'Province not found' },
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
			.get('/regencies/:id', async ({ params, status }) => {
				const row = await locationService.getRegency(params.id);
				if (!row) {
					return status(
						404,
						errorEnvelope(404, 'Not found', [
							{ message: 'Regency not found' },
						]),
					);
				}
				return ok(row);
			})
			.get(
				'/provinces/:id/regencies',
				async ({ params }) =>
					ok(await locationService.getRegenciesByProvince(params.id)),
			)
			.get(
				'/districts',
				async ({ query }) =>
					okPaginated(
						await locationService.paginateDistricts(
							districtQuerySchema.parse(query),
						),
					),
			)
			.get('/districts/:id', async ({ params, status }) => {
				const row = await locationService.getDistrict(params.id);
				if (!row) {
					return status(
						404,
						errorEnvelope(404, 'Not found', [
							{ message: 'District not found' },
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
			.get('/villages/:id', async ({ params, status }) => {
				const row = await locationService.getVillage(params.id);
				if (!row) {
					return status(
						404,
						errorEnvelope(404, 'Not found', [
							{ message: 'Village not found' },
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
