import { domainPlugin } from '@http/plugin';
import { created, noContent, ok } from '@http/response';
import { documentImageFrom } from '@providers/s3/document-image';
import { container } from 'tsyringe';
import { LETTERHEAD_SERVICE_TOKEN } from '../constants/di';
import {
	letterheadCreateSchema,
	letterheadIdParamsSchema,
	letterheadImageParamsSchema,
	letterheadPatchSchema,
	MAX_LETTERHEAD_IMAGE_MB,
} from '../contracts/letterhead.contract';

const image = (body: unknown, field: string) => documentImageFrom(body, { field, maxMb: MAX_LETTERHEAD_IMAGE_MB });

/** The optional `footer` part of a multipart body: absent or empty is no footer. */
function optionalImage(body: unknown, field: string): File | null {
	const value = body && typeof body === 'object' ? (body as Record<string, unknown>)[field] : undefined;
	if (value === undefined || value === null || value === '' || (value instanceof File && value.size === 0)) return null;
	return image(body, field);
}

/**
 * REST controller for letterhead (kop surat) templates
 * (`/companies/letterheads`, ERP-0165).
 *
 * @remarks
 * Any organization member may read them, like the company profile, because
 * prints need them. Managing them needs `company:update`. Images are
 * multipart parts (`header`, `footer`, or `file` when replacing one).
 */
export class LetterheadController {
	static plugin() {
		const service = container.resolve(LETTERHEAD_SERVICE_TOKEN);

		return domainPlugin({
			name: 'company-letterheads',
			prefix: '/companies/letterheads',
			tags: ['Company'],
			guards: 'erp',
		})
			.get('', async () => ok(await service.list()), {
				erp: { permission: [] },
				detail: { description: 'Letterhead templates, the default first' },
			})
			.get('/:id', async ({ params }) => ok(await service.get(letterheadIdParamsSchema.parse(params).id)), {
				erp: { permission: [] },
				detail: { description: 'One letterhead template with its image URLs' },
			})
			.post(
				'',
				async ({ body, erp }) =>
					created(
						await service.create(
							letterheadCreateSchema.parse(body),
							{ header: image(body, 'header'), footer: optionalImage(body, 'footer') },
							erp.session.user.id,
						),
					),
				{
					erp: { permission: ['company:update'] },
					detail: {
						description:
							'Uploads a letterhead template (multipart: `name`, `isDefault`, `header` image, optional `footer` image)',
					},
				},
			)
			.patch(
				'/:id',
				async ({ params, body, erp }) =>
					ok(
						await service.update(
							letterheadIdParamsSchema.parse(params).id,
							letterheadPatchSchema.parse(body),
							erp.session.user.id,
						),
					),
				{
					erp: { permission: ['company:update'] },
					detail: { description: 'Renames a letterhead template or makes it the default' },
				},
			)
			.put(
				'/:id/:kind',
				async ({ params, body, erp }) => {
					const { id, kind } = letterheadImageParamsSchema.parse(params);
					return ok(await service.setImage(id, kind, image(body, 'file'), erp.session.user.id));
				},
				{
					erp: { permission: ['company:update'] },
					detail: { description: 'Replaces the header or footer image of a letterhead (multipart `file`)' },
				},
			)
			.delete(
				'/:id/footer',
				async ({ params, erp }) =>
					ok(await service.setImage(letterheadIdParamsSchema.parse(params).id, 'footer', null, erp.session.user.id)),
				{
					erp: { permission: ['company:update'] },
					detail: { description: 'Removes the footer image of a letterhead' },
				},
			)
			.delete(
				'/:id',
				async ({ params, erp }) => {
					await service.remove(letterheadIdParamsSchema.parse(params).id, erp.session.user.id);
					return noContent();
				},
				{
					erp: { permission: ['company:update'] },
					detail: { description: 'Deletes a letterhead template; documents that used it still print with it' },
				},
			);
	}
}
