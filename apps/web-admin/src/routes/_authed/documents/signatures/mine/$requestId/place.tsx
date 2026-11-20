import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { FileSignature, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';

import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Slider } from '@ims-erp/ui/components/slider';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { documentDetailQueryOptions } from '@/lib/documents-api';
import {
	attachSignedPdf,
	incomingSignatureRequestsQueryOptions,
	signatureImageFromRequest,
} from '@/lib/signature-api';
import { usePermission } from '@/lib/use-permission';

/** Fixed render scale: the placement is stored in PDF points, not screen px. */
const RENDER_SCALE = 1.5;

export const Route = createFileRoute('/_authed/documents/signatures/mine/$requestId/place')({
	component: PlaceSignaturePage,
});

/**
 * `/documents/signatures/mine/$requestId/place` — place the caller's signature
 * image on one of the document's PDFs (ERP-0048, signed-PDF slice).
 *
 * @remarks
 * `pdfjs-dist` renders the chosen page to a canvas at a fixed scale; the
 * signature image is an overlay the user drags and resizes; "Apply" embeds it
 * with `pdf-lib` and uploads the result. Placement is final — the backend
 * refuses a second one, so this page disables itself once `hasSignedPdf`.
 */
function PlaceSignaturePage() {
	const { t } = useTranslation(['signatures', 'common']);
	const { requestId } = Route.useParams();
	const canSign = usePermission('document.signature_sign');

	const requests = useQuery({
		...incomingSignatureRequestsQueryOptions({ page: 1, limit: 50 }),
		enabled: canSign,
	});
	const request = requests.data?.rows.find((row) => row.id === requestId);
	const imageUrl = request ? signatureImageFromRequest(request) : null;

	const document = useQuery({
		...documentDetailQueryOptions(request?.documentId ?? ''),
		enabled: Boolean(request?.documentId),
	});
	const pdfFiles = (document.data?.files ?? []).filter(
		(file) => file.mimeType === 'application/pdf',
	);

	const [fileId, setFileId] = useState('');
	const [pageIndex, setPageIndex] = useState(1);
	const [pageCount, setPageCount] = useState(0);
	const [scale, setScale] = useState(0.25);
	const [left, setLeft] = useState(0.6);
	const [top, setTop] = useState(0.75);
	const [rendering, setRendering] = useState(false);
	const [applying, setApplying] = useState(false);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const overlayRef = useRef<HTMLImageElement>(null);
	// Kept for the preview only: the export path fetches the bytes itself.
	const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

	useEffect(() => {
		pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
	}, []);

	useEffect(() => {
		if (!fileId) return;
		const file = pdfFiles.find((candidate) => candidate.id === fileId);
		if (!file) return;
		let cancelled = false;
		setRendering(true);
		(async () => {
			const response = await fetch(file.url);
			const bytes = await response.arrayBuffer();
			const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
			if (cancelled) {
				void (doc as unknown as { destroy?: () => Promise<void> }).destroy?.();
				return;
			}
			await (pdfDocRef.current as unknown as { destroy?: () => Promise<void> } | null)?.destroy?.();
			pdfDocRef.current = doc;
			setPageCount(doc.numPages);
			setPageIndex(1);
			setRendering(false);
		})().catch((error: unknown) => {
			if (cancelled) return;
			setRendering(false);
			toast.error(error instanceof Error ? error.message : String(error));
		});
		return () => {
			cancelled = true;
		};
	}, [fileId]);

	useEffect(() => {
		const doc = pdfDocRef.current;
		const canvas = canvasRef.current;
		if (!doc || !canvas || pageIndex < 1 || pageIndex > doc.numPages) return;
		let cancelled = false;
		setRendering(true);
		(async () => {
			const page = await doc.getPage(pageIndex);
			const viewport = page.getViewport({ scale: RENDER_SCALE });
			canvas.width = viewport.width;
			canvas.height = viewport.height;
			// pdfjs v6: pass the canvas, not the 2D context — supplying both makes
			// the render reject (the context is the deprecated path).
			await page.render({ canvas, viewport }).promise;
			if (cancelled) return;
			setRendering(false);
		})().catch((error: unknown) => {
			if (cancelled) return;
			setRendering(false);
			toast.error(error instanceof Error ? error.message : String(error));
		});
		return () => {
			cancelled = true;
		};
		// `pageCount` is the signal that the document finished loading: without
		// it the first render pass runs before `pdfDocRef` is populated and the
		// canvas keeps its default 300x150 size.
	}, [pageIndex, pageCount, fileId]);

	const apply = async () => {
		const doc = pdfDocRef.current;
		const canvas = canvasRef.current;
		if (!doc || !canvas || !request || !imageUrl) return;
		setApplying(true);
		try {
			const page = await doc.getPage(pageIndex);
			const viewport = page.getViewport({ scale: 1 });
			const pdf = await PDFDocument.load(await doc.getData());
			// Fetch the bytes and decode them here: drawing the <img> from object
			// storage onto a canvas taints it, and a tainted canvas cannot be
			// exported. A bitmap decoded from fetched bytes is not tainted.
			const { bytes: pngBytes, width: imageWidth, height: imageHeight } =
				await pngFromUrl(imageUrl);
			const embedded = await pdf.embedPng(pngBytes);
			const pdfPage = pdf.getPage(pageIndex - 1);
			const width = scale * viewport.width;
			const height = (imageHeight / imageWidth) * width;
			pdfPage.drawImage(embedded, {
				x: left * viewport.width,
				y: viewport.height - top * viewport.height - height,
				width,
				height,
			});
			const bytes = await pdf.save();
			const file = new File([bytes.buffer as ArrayBuffer], 'signed.pdf', {
				type: 'application/pdf',
			});
			await attachSignedPdf(request.id, file, fileId);
			toast.success(t('signatures:pdfPlaced'));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t('common:error.failed'));
		} finally {
			setApplying(false);
		}
	};

	if (!canSign) {
		return <div className='text-sm text-muted-foreground'>{t('signatures:noPermission')}</div>;
	}
	if (requests.isError) return <ErrorState error={requests.error} bordered />;
	if (request && document.isError) return <ErrorState error={document.error} bordered />;
	if (requests.isPending || (request && document.isPending)) return <PageSkeleton cards={1} />;
	if (!request) {
		return <EmptyState title={t('signatures:requestNotFound')} bordered />;
	}

	const file = pdfFiles.find((candidate) => candidate.id === fileId);

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex items-center gap-3'>
				<FileSignature className='size-5 text-muted-foreground' />
				<div>
					<h1 className='text-lg font-semibold'>{t('signatures:placeTitle')}</h1>
					<p className='text-sm text-muted-foreground'>
						{request.documentCode ?? request.documentId}
						{request.documentTitle ? ` · ${request.documentTitle}` : ''}
					</p>
				</div>
			</div>

			{!imageUrl && (
				<Card>
					<CardContent className='text-sm text-muted-foreground'>
						{t('signatures:imageRequired')}
					</CardContent>
				</Card>
			)}

			{imageUrl && pdfFiles.length === 0 && (
				<Card>
					<CardContent className='text-sm text-muted-foreground'>
						{t('signatures:noPdfOnDocument')}
					</CardContent>
				</Card>
			)}

			{imageUrl && pdfFiles.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>{t('signatures:placeSettings')}</CardTitle>
						<CardDescription>{t('signatures:placeHint')}</CardDescription>
					</CardHeader>
					<CardContent className='flex flex-col gap-4'>
						<div className='flex flex-wrap items-end gap-3'>
							<div className='flex flex-col gap-1'>
								<span className='text-xs text-muted-foreground'>{t('signatures:pdfFile')}</span>
								<Select
									value={fileId}
									onValueChange={(value) => setFileId(value ?? '')}
								>
									<SelectTrigger className='w-72'>
										<SelectValue placeholder={t('signatures:pdfFilePlaceholder')} />
									</SelectTrigger>
									<SelectContent>
										{pdfFiles.map((candidate) => (
											<SelectItem key={candidate.id} value={candidate.id}>
												{candidate.fileName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							{pageCount > 0 && (
								<div className='flex items-center gap-2'>
									<Button
										variant='outline'
										size='sm'
										disabled={pageIndex <= 1}
										onClick={() => setPageIndex((page) => Math.max(1, page - 1))}
									>
										{t('signatures:prevPage')}
									</Button>
									<span className='text-sm'>
										{pageIndex} / {pageCount}
									</span>
									<Button
										variant='outline'
										size='sm'
										disabled={pageIndex >= pageCount}
										onClick={() => setPageIndex((page) => Math.min(pageCount, page + 1))}
									>
										{t('signatures:nextPage')}
									</Button>
								</div>
							)}
						</div>

						{file && (
							<div className='relative w-fit overflow-hidden rounded-md border'>
								<canvas ref={canvasRef} className='block max-w-full' />
								<img
									ref={overlayRef}
									src={imageUrl}
									alt=''
									className='pointer-events-none absolute select-none'
									style={{
										left: `${left * 100}%`,
										top: `${top * 100}%`,
										width: `${scale * 100}%`,
										opacity: 0.9,
									}}
								/>
								{rendering && (
									<div className='absolute inset-0 flex items-center justify-center bg-background/60'>
										<Loader2 className='size-6 animate-spin' />
									</div>
								)}
							</div>
						)}

						{file && (
							<div className='flex flex-col gap-3'>
								<div className='flex flex-col gap-1'>
									<span className='text-xs text-muted-foreground'>{t('signatures:positionX')}</span>
									<Slider
										value={left}
										min={0}
										max={0.9}
										step={0.01}
										onValueChange={(value) => setLeft(Number(value))}
									/>
								</div>
								<div className='flex flex-col gap-1'>
									<span className='text-xs text-muted-foreground'>{t('signatures:positionY')}</span>
									<Slider
										value={top}
										min={0.05}
										max={0.95}
										step={0.01}
										onValueChange={(value) => setTop(Number(value))}
									/>
								</div>
								<div className='flex flex-col gap-1'>
									<span className='text-xs text-muted-foreground'>{t('signatures:width')}</span>
									<Slider
										value={scale}
										min={0.08}
										max={0.6}
										step={0.01}
										onValueChange={(value) => setScale(Number(value))}
									/>
								</div>
								<div>
									<Button disabled={applying || rendering} onClick={() => void apply()}>
										{applying ? <Loader2 className='size-4 animate-spin' /> : null}
										{t('signatures:applyPlacement')}
									</Button>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			<div>
				<Link to='/documents/signatures/mine' className='text-sm text-muted-foreground hover:underline'>
					{t('signatures:backToMine')}
				</Link>
			</div>
		</div>
	);
}

/**
 * Fetches an image and re-encodes it to PNG bytes on an untainted canvas.
 *
 * @remarks
 * The stored signature is WebP and `pdf-lib` cannot embed WebP, so it is drawn
 * onto a canvas and exported as PNG. The bytes are fetched and decoded into an
 * `ImageBitmap` first: drawing an `<img>` that came from object storage taints
 * the canvas and `toBlob` then throws.
 */
async function pngFromUrl(
	url: string,
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`image fetch failed (${response.status})`);
	const bitmap = await createImageBitmap(await response.blob());
	const canvas = document.createElement('canvas');
	canvas.width = bitmap.width;
	canvas.height = bitmap.height;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('canvas unavailable');
	context.drawImage(bitmap, 0, 0);
	bitmap.close();
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob((value) => resolve(value), 'image/png'),
	);
	if (!blob) throw new Error('could not encode the signature image');
	return {
		bytes: new Uint8Array(await blob.arrayBuffer()),
		width: canvas.width,
		height: canvas.height,
	};
}
