/**
 * Customer portal document downloads (ERP-0079).
 *
 * Covers: a PDF is rendered only for the customer's own document (another
 * customer's id and a draft SPH are 404), the print URL carries a render
 * token (and the organization for invoices), an unconfigured renderer is a
 * clear 503, and project files resolve to the customer's own file link only.
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { PortalContext } from '@authorization/portal-auth';
import { appConfig } from '@config/providers/config';
import { PortalNotFoundError, PortalPdfUnavailableError } from '../../src/app/portal/errors/portal.errors';
import { PortalDocumentFileService } from '../../src/app/portal/services/portal-document-file.service';

const portal = { customerId: 'c1' } as PortalContext;
let rendered: string[];
let configured: boolean;
let service: PortalDocumentFileService;

beforeEach(() => {
	rendered = [];
	configured = true;
	(appConfig.pdf as { renderBaseUrl?: string }).renderBaseUrl = 'http://render.local';
	service = new PortalDocumentFileService(
		{
			get configured() {
				return configured;
			},
			render: async (url: string) => {
				rendered.push(url);
				return new Uint8Array([37, 80, 68, 70]);
			},
		},
		{
			getQuotation: async (customerId, id) => {
				if (customerId !== 'c1') throw new Error('not found');
				if (id === 'q-draft') return { id, code: 'QT-0', status: 'draft' } as never;
				if (id === 'q-1') return { id, code: '0001/QT/DEV', status: 'sent' } as never;
				throw new Error('not found');
			},
			getInvoice: async (customerId, id) => {
				if (customerId !== 'c1' || id !== 'inv-1') throw new Error('not found');
				return { id, organizationId: 'org-1', code: '0001/INV' } as never;
			},
		},
		{ getForCustomer: async (customerId, id) => (customerId === 'c1' && id === 'w-1' ? ({ id, code: 'GAR-1' } as never) : null) },
		{
			listForCustomer: async () => [{ id: 'p1' }] as never,
			getForCustomer: async () => ({ files: [{ id: 'f-1', url: 'https://storage.example/f-1' }] }) as never,
		},
	);
});

describe('PortalDocumentFileService', () => {
	test('renders the customer’s sent SPH, invoice and warranty with a render token', async () => {
		expect((await service.pdf(portal, 'quotation', 'q-1')).fileName).toBe('0001-QT-DEV.pdf');
		expect((await service.pdf(portal, 'invoice', 'inv-1')).contentType).toBe('application/pdf');
		await service.pdf(portal, 'warranty', 'w-1');
		expect(rendered[0]).toStartWith('http://render.local/print/quotations/q-1?token=');
		expect(rendered[1]).toStartWith('http://render.local/print/invoices/inv-1?org=org-1&token=');
		expect(rendered[2]).toStartWith('http://render.local/print/warranties/w-1?token=');
	});

	test('a draft SPH or another customer’s document is not found', async () => {
		await expect(service.pdf(portal, 'quotation', 'q-draft')).rejects.toBeInstanceOf(PortalNotFoundError);
		await expect(service.pdf({ customerId: 'c2' } as PortalContext, 'invoice', 'inv-1')).rejects.toBeInstanceOf(PortalNotFoundError);
		await expect(service.pdf(portal, 'warranty', 'w-9')).rejects.toBeInstanceOf(PortalNotFoundError);
		expect(rendered).toEqual([]);
	});

	test('without a configured renderer the download says so', async () => {
		configured = false;
		await expect(service.pdf(portal, 'invoice', 'inv-1')).rejects.toBeInstanceOf(PortalPdfUnavailableError);
	});

	test('a project file resolves to the customer’s own file only', async () => {
		expect(await service.projectFileUrl(portal, 'f-1')).toBe('https://storage.example/f-1');
		await expect(service.projectFileUrl(portal, 'f-9')).rejects.toBeInstanceOf(PortalNotFoundError);
	});
});
