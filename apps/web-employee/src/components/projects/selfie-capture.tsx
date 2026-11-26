import { useRef, useState } from 'react';
import { Camera, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@ims-erp/ui/components/button';
import { Input } from '@ims-erp/ui/components/input';
import { Label } from '@ims-erp/ui/components/label';

/** Browser position, with the accuracy the API reports. */
export type TPosition = { latitude: number; longitude: number; accuracyMeters: number | null };

/**
 * Reads one GPS fix.
 *
 * @remarks
 * `enableHighAccuracy` + a 20 s timeout: a cached coarse fix is worse than a
 * failed check-in here, because the server's radius verdict depends on it.
 */
export function locate(): Promise<TPosition> {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error('geolocation-unavailable'));
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(position) =>
				resolve({
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
					accuracyMeters: Number.isFinite(position.coords.accuracy)
						? Math.round(position.coords.accuracy * 100) / 100
						: null,
				}),
			reject,
			{ enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
		);
	});
}

/** Draws the current video frame into a JPEG File. */
async function grabFrame(video: HTMLVideoElement): Promise<File> {
	const canvas = document.createElement('canvas');
	canvas.width = video.videoWidth;
	canvas.height = video.videoHeight;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('capture-unavailable');
	context.drawImage(video, 0, 0, canvas.width, canvas.height);
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
	if (!blob) throw new Error('capture-failed');
	return new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
}

/**
 * Selfie capture with a live camera and a file-input fallback.
 *
 * @remarks
 * `getUserMedia` needs a secure context (HTTPS or localhost); when it is
 * unavailable or refused, the plain `<input capture>` still opens the phone's
 * camera. The bytes are what the server sniffs - never the extension.
 */
export function SelfieCapture({ onCapture }: { onCapture: (file: File | null) => void }) {
	const { t } = useTranslation('employee');
	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const [preview, setPreview] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [streaming, setStreaming] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const stop = () => {
		streamRef.current?.getTracks().forEach((track) => track.stop());
		streamRef.current = null;
		setStreaming(false);
	};

	const start = async () => {
		setMessage(null);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
			streamRef.current = stream;
			if (videoRef.current) {
				videoRef.current.srcObject = stream;
				await videoRef.current.play();
			}
			setStreaming(true);
		} catch {
			setMessage(t('projects.cameraUnavailable'));
		}
	};

	const shoot = async () => {
		if (!videoRef.current) return;
		setBusy(true);
		try {
			const file = await grabFrame(videoRef.current);
			stop();
			setPreview(URL.createObjectURL(file));
			onCapture(file);
		} catch {
			setMessage(t('projects.cameraFailed'));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className='space-y-2'>
			{/* The camera only mounts while streaming: an idle <video> renders a
			    large empty box (caught in the browser walk-through). */}
			{streaming ? (
				<video ref={videoRef} playsInline muted className='aspect-square w-full rounded-md border bg-muted object-cover' />
			) : null}
			{preview ? <img src={preview} alt={t('projects.selfie')} className='aspect-square w-full rounded-md border object-cover' /> : null}
			<div className='flex flex-wrap gap-2'>
				<Button type='button' variant='outline' onClick={() => void start()}>
					<Camera /> {t('projects.cameraStart')}
				</Button>
				<Button type='button' onClick={() => void shoot()} disabled={busy || !streaming}>
					{t('projects.cameraShoot')}
				</Button>
			</div>
			<Label htmlFor='selfie-file' className='text-xs text-muted-foreground'>
				{t('projects.cameraHint')}
			</Label>
			<Input
				id='selfie-file'
				type='file'
				accept='image/*'
				capture='user'
				onChange={(event) => {
					const file = event.target.files?.[0] ?? null;
					if (file) setPreview(URL.createObjectURL(file));
					onCapture(file);
				}}
			/>
			{message ? <p className='text-xs text-destructive'>{message}</p> : null}
			<p className='flex items-center gap-1 text-xs text-muted-foreground'>
				<MapPin className='size-3' /> {t('projects.radius', { radius: 100 })}
			</p>
		</div>
	);
}

