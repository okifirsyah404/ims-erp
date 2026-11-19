import { publicApiGuard } from '@authorization/public-api-auth';
import { container } from 'tsyringe';
import type { z } from 'zod';
import { domainPlugin } from '@http/plugin';
import { created, ok } from '@http/response';
import { WEBSITE_INQUIRY_SERVICE_TOKEN } from '../constants/di';
import {
	contactMessageSchema,
	demoRequestSchema,
	idempotencyKeySchema,
	rfqSubmissionSchema,
} from '../contracts/website-inquiry.contract';
import { WebsiteInquiryError } from '../errors/lead.errors';

function idempotencyKey(headers: Record<string, string | undefined>): string | null {
	const raw = headers['idempotency-key'];
	return raw === undefined || raw === '' ? null : idempotencyKeySchema.parse(raw);
}

/**
 * The website sends JSON when there are no files and multipart
 * (`payload` = JSON string, `attachments` = files) when there are.
 */
function rfqParts(body: unknown): { payload: unknown; files: File[] } {
	if (body && typeof body === 'object' && 'payload' in body) {
		const { payload, attachments } = body as { payload: unknown; attachments?: unknown };
		let parsed: unknown = payload;
		if (typeof payload === 'string') {
			try {
				parsed = JSON.parse(payload);
			} catch {
				throw new WebsiteInquiryError('badPayload');
			}
		}
		const list = attachments === undefined ? [] : [attachments].flat();
		if (!list.every((file) => file instanceof File)) throw new WebsiteInquiryError('fileType');
		return { payload: parsed, files: list as File[] };
	}
	return { payload: body, files: [] };
}

/** 201 for a new submission, 200 when an Idempotency-Key replay answered. */
function receipt<T>(replayed: boolean, data: T, status: (code: 201, body: unknown) => unknown) {
	return replayed ? ok(data) : status(201, created(data));
}

/**
 * Public website API (`/public/v1`, ADR-0011 step 3b): website forms become
 * leads. Server-to-server only — every route opts into the `publicApi`
 * macro (website API key). Paths are what the website's `ERP_*_PATH` route
 * map points at; payload shapes follow the website's fixed contracts.
 */
export class PublicWebsiteController {
	/**
	 * @param prefix - The website API path: `/projects/public/v1` (primary) or the
	 * `/public/v1` alias the deployed website still calls (ADR-0024 Q34).
	 */
	static plugin(prefix = '/projects/public/v1') {
		const inquiries = container.resolve(WEBSITE_INQUIRY_SERVICE_TOKEN);
		const parse = <S extends z.ZodType>(schema: S, input: unknown): z.output<S> => schema.parse(input);

		return domainPlugin({ name: `public-website:${prefix}`, prefix, tags: ['Public Website'] })
			.use(publicApiGuard())
			.post(
				'/rfq',
				async ({ body, headers, status }) => {
					const { payload, files } = rfqParts(body);
					const result = await inquiries.submitRfq(parse(rfqSubmissionSchema, payload), files, idempotencyKey(headers));
					// Customer-portal linking arrives with the portal (M02 stage 2).
					return receipt(result.replayed, { reference: result.reference, linkedToAccount: false }, status);
				},
				{ publicApi: true, detail: { description: 'Website request for quotation (JSON or multipart)' } },
			)
			.post(
				'/contact',
				async ({ body, headers, status }) => {
					const result = await inquiries.sendContactMessage(parse(contactMessageSchema, body), idempotencyKey(headers));
					return receipt(result.replayed, { reference: result.reference }, status);
				},
				{ publicApi: true, detail: { description: 'Website contact message' } },
			)
			.post(
				'/demo',
				async ({ body, headers, status }) => {
					const result = await inquiries.requestDemo(parse(demoRequestSchema, body), idempotencyKey(headers));
					return receipt(result.replayed, { reference: result.reference }, status);
				},
				{ publicApi: true, detail: { description: 'Website demo request' } },
			);
	}
}
