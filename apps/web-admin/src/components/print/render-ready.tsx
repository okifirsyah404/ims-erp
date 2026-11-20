import { type ReactNode, useEffect, useState } from 'react';

/**
 * Wraps a public print view for the backend's PDF renderer (ERP-0067 / ERP-0079): white
 * paper background, and `data-render-ready="true"` once every image has loaded (or
 * failed), which is what the renderer waits for before printing.
 */
export function RenderReady({ children }: { children: ReactNode }) {
	const [ready, setReady] = useState(false);

	useEffect(() => {
		const { body } = document;
		const previous = body.style.background;
		body.style.background = 'white';
		return () => {
			body.style.background = previous;
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		const pending = Array.from(document.images)
			.filter((image) => !image.complete)
			.map(
				(image) =>
					new Promise((resolve) => {
						image.addEventListener('load', resolve, { once: true });
						image.addEventListener('error', resolve, { once: true });
					}),
			);
		void Promise.all(pending).then(() => {
			if (!cancelled) setReady(true);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	return <div data-render-ready={ready ? 'true' : 'false'}>{children}</div>;
}
