import type { InjectionToken } from 'tsyringe';
import { appConfig } from '@config/providers/config';

/**
 * Renders a web page to PDF (ERP-0067). The page is one of the admin app's
 * print views, so the PDF looks exactly like the printed document.
 */
export interface IPdfRenderer {
	/** False when no Chromium or render URL is configured: callers skip the PDF. */
	readonly configured: boolean;
	/**
	 * Opens `url`, waits until the page marks itself ready
	 * (`[data-render-ready="true"]`) and prints it to an A4 PDF.
	 */
	render(url: string): Promise<Uint8Array>;
}

export const PDF_RENDERER_TOKEN: InjectionToken<IPdfRenderer> = Symbol('PDF_RENDERER');

const READY_TIMEOUT_MS = 30_000;

/**
 * {@link IPdfRenderer} over headless Chromium (playwright-core; the browser is
 * not bundled: `PDF_CHROMIUM_PATH` points at an installed Chromium/Chrome).
 * One browser per render: documents are rendered rarely, and a crashed page
 * never leaks into the next one.
 */
export class ChromiumPdfRenderer implements IPdfRenderer {
	constructor(private readonly executablePath: string | null = appConfig.pdf.chromiumPath ?? null) {}

	get configured(): boolean {
		return Boolean(this.executablePath && appConfig.pdf.renderBaseUrl);
	}

	async render(url: string): Promise<Uint8Array> {
		if (!this.executablePath) throw new Error('PDF_CHROMIUM_PATH is not set');
		const { chromium } = await import('playwright-core');
		const browser = await chromium.launch({ executablePath: this.executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
		try {
			// Indonesian locale: the admin app picks its language from the browser.
			const context = await browser.newContext({ locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
			const page = await context.newPage();
			await page.goto(url, { waitUntil: 'networkidle', timeout: READY_TIMEOUT_MS });
			await page.waitForSelector('[data-render-ready="true"]', { timeout: READY_TIMEOUT_MS });
			const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
			return new Uint8Array(pdf);
		} finally {
			await browser.close();
		}
	}
}
