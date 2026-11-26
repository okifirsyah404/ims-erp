import { FileText } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Skeleton } from '@ims-erp/ui/components/skeleton';
import type { TDocumentPreview } from '@/lib/documents-api';

/**
 * PDF rendering shared by the registry cards and the document viewer.
 *
 * @remarks
 * `pdfjs-dist` renders into a canvas, so nothing here can be lazy-loaded by
 * the browser: a card asks for page one only once it scrolls near the
 * viewport, and the viewer renders a page only when it scrolls into range.
 * Thumbnails are cached as data URLs for the session, keyed by the presigned
 * URL (a refreshed URL is a new render, which is what makes stale links
 * self-heal).
 */

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/** Card thumbnail width in CSS pixels; the A4 ratio is preserved. */
const THUMB_WIDTH = 320;

/** Session cache of first-page renders, capped so a long browse cannot grow forever. */
const THUMB_CACHE_LIMIT = 200;
const thumbCache = new Map<string, Promise<string>>();

function firstPageDataUrl(url: string): Promise<string> {
	const cached = thumbCache.get(url);
	if (cached) return cached;
	if (thumbCache.size >= THUMB_CACHE_LIMIT) thumbCache.clear();
	const render = (async () => {
		const bytes = await (await fetch(url)).arrayBuffer();
		const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
		try {
			const page = await pdf.getPage(1);
			const base = page.getViewport({ scale: 1 });
			const viewport = page.getViewport({ scale: THUMB_WIDTH / base.width });
			const canvas = document.createElement('canvas');
			canvas.width = Math.ceil(viewport.width);
			canvas.height = Math.ceil(viewport.height);
			await page.render({ canvas, viewport }).promise;
			return canvas.toDataURL('image/webp', 0.75);
		} finally {
			void (pdf as unknown as { destroy?: () => Promise<void> }).destroy?.();
		}
	})();
	thumbCache.set(url, render);
	// A failed render must not be cached, or a retry would replay the failure.
	render.catch(() => thumbCache.delete(url));
	return render;
}

/** True once the element has scrolled within `margin` of the viewport. */
function useInView<T extends HTMLElement>(margin: string) {
	const ref = useRef<T>(null);
	const [inView, setInView] = useState(false);

	useEffect(() => {
		const element = ref.current;
		if (!element || inView) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					setInView(true);
					observer.disconnect();
				}
			},
			{ rootMargin: margin },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [inView, margin]);

	return { ref, inView };
}

/**
 * First page of a document as a card thumbnail: a PDF page one, an image, or
 * a document icon when there is no file or it cannot be fetched.
 *
 * @param file - The newest file of the row, or `null`
 * @param onError - Called when the file cannot be fetched (a stale presigned
 * URL); the list refetches once so the card gets a fresh link
 */
export function DocumentThumbnail({
	file,
	alt,
	onError,
}: {
	file: TDocumentPreview | null;
	alt: string;
	onError?: () => void;
}) {
	const { ref, inView } = useInView<HTMLDivElement>('300px');
	const [src, setSrc] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);
	const isImage = file?.mimeType?.startsWith('image/') ?? false;

	useEffect(() => {
		if (!file || !inView || isImage) return;
		let cancelled = false;
		firstPageDataUrl(file.url)
			.then((dataUrl) => {
				if (!cancelled) setSrc(dataUrl);
			})
			.catch(() => {
				if (cancelled) return;
				setFailed(true);
				onError?.();
			});
		return () => {
			cancelled = true;
		};
	}, [file, inView, isImage, onError]);

	return (
		<div
			ref={ref}
			className='flex aspect-210/297 w-full items-center justify-center overflow-hidden rounded-md border bg-muted'
		>
			{!file || failed ? (
				<FileText className='size-10 text-muted-foreground' aria-label={alt} />
			) : isImage ? (
				<img
					src={file.url}
					alt={alt}
					loading='lazy'
					className='size-full object-cover'
					onError={() => {
						setFailed(true);
						onError?.();
					}}
				/>
			) : src ? (
				<img src={src} alt={alt} className='size-full object-cover object-top' />
			) : (
				<Skeleton className='size-full rounded-none' />
			)}
		</div>
	);
}

type TPdfPageProps = {
	pdf: pdfjsLib.PDFDocumentProxy;
	pageNumber: number;
	/** Render even when off-screen (printing needs every page). */
	force: boolean;
	onRendered: () => void;
};

function PdfPage({ pdf, pageNumber, force, onRendered }: TPdfPageProps) {
	const boxRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [inView, setInView] = useState(false);
	const [aspect, setAspect] = useState('210 / 297');
	const rendered = useRef(false);

	useEffect(() => {
		const element = boxRef.current;
		if (!element) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					setInView(true);
					observer.disconnect();
				}
			},
			{ rootMargin: '800px' },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if ((!inView && !force) || rendered.current) return;
		const box = boxRef.current;
		const canvas = canvasRef.current;
		if (!box || !canvas) return;
		rendered.current = true;
		(async () => {
			const page = await pdf.getPage(pageNumber);
			const base = page.getViewport({ scale: 1 });
			setAspect(`${base.width} / ${base.height}`);
			// Cap the pixel ratio: a 3x phone screen would quadruple the work for
			// no readable gain.
			const ratio = Math.min(window.devicePixelRatio || 1, 2);
			const width = box.clientWidth || base.width;
			const viewport = page.getViewport({ scale: (width / base.width) * ratio });
			canvas.width = Math.ceil(viewport.width);
			canvas.height = Math.ceil(viewport.height);
			// pdfjs v6 takes the canvas, not the 2D context (the context path is
			// deprecated and rejects).
			await page.render({ canvas, viewport }).promise;
			onRendered();
		})().catch(() => {
			rendered.current = false;
		});
	}, [inView, force, pdf, pageNumber, onRendered]);

	return (
		<div
			ref={boxRef}
			className='relative w-full overflow-hidden rounded-sm bg-white shadow-sm'
			style={{ aspectRatio: aspect }}
		>
			<canvas ref={canvasRef} className='absolute inset-0 size-full' />
		</div>
	);
}

/**
 * Every page of a PDF, stacked top to bottom, rendered as it approaches the
 * viewport.
 *
 * @param url - Presigned inline URL of the file
 * @param force - Render every page now (the print button)
 * @param onAllRendered - Called once all pages have drawn; the print handler
 * waits for it so unvisited pages are not printed blank
 */
export function DocumentPages({
	url,
	force,
	onAllRendered,
}: {
	url: string;
	force: boolean;
	onAllRendered?: () => void;
}) {
	const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
	const [failed, setFailed] = useState(false);
	const drawn = useRef(0);
	const { t } = useTranslation('documents');

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const bytes = await (await fetch(url)).arrayBuffer();
			const loaded = await pdfjsLib.getDocument({ data: bytes }).promise;
			if (cancelled) {
				void (loaded as unknown as { destroy?: () => Promise<void> }).destroy?.();
				return;
			}
			setPdf(loaded);
		})().catch(() => {
			if (!cancelled) setFailed(true);
		});
		return () => {
			cancelled = true;
		};
	}, [url]);

	const handleRendered = useCallback(() => {
		drawn.current += 1;
		if (pdf && drawn.current >= pdf.numPages) onAllRendered?.();
	}, [pdf, onAllRendered]);

	// Printing a document whose pages are already drawn: no page reports again,
	// so tell the print handler right away.
	useEffect(() => {
		if (force && pdf && drawn.current >= pdf.numPages) onAllRendered?.();
	}, [force, pdf, onAllRendered]);

	if (failed) {
		return <div className='text-sm text-muted-foreground'>{t('previewUnavailable')}</div>;
	}
	if (!pdf) {
		return <Skeleton className='mx-auto aspect-210/297 w-full max-w-[900px]' />;
	}

	return (
		<div className='mx-auto flex w-full max-w-[900px] flex-col gap-4 print:max-w-none print:gap-0'>
			{Array.from({ length: pdf.numPages }, (_, index) => (
				<PdfPage
					key={index}
					pdf={pdf}
					pageNumber={index + 1}
					force={force}
					onRendered={handleRendered}
				/>
			))}
		</div>
	);
}
