import { render } from '@react-email/render';
import type { ReactElement } from 'react';

/**
 * Renders a template component into email-ready HTML plus a plain-text
 * alternative — a single call per template, one source of truth for both
 * MIME parts (the transport sends both).
 */
export async function renderEmail(
	component: ReactElement,
): Promise<{ html: string; text: string }> {
	return {
		html: await render(component),
		text: await render(component, { plainText: true }),
	};
}
