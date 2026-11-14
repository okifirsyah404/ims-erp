import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Field, FieldDescription, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { toast } from '@/components/toast';
import { formatDateTime } from '@/lib/format';
import { EVIDENCE_KINDS, removeEvidence, type TEvidenceKind, type TProjectDetail, uploadEvidence } from '@/lib/project-api';
import { usePermission } from '@/lib/use-permission';

/**
 * Evidence files (function test, training, signed BAST, photos). Closing a
 * project needs the first three; the server checks file content (JPG, PNG,
 * WebP, PDF, 15 MB).
 */
export function ProjectEvidenceCard({ project, actorUserId }: { project: TProjectDetail; actorUserId: string | undefined }) {
	const { t, i18n } = useTranslation(['projects', 'common']);
	const queryClient = useQueryClient();
	const canUpload = usePermission('task.update');
	const canManage = usePermission('project.update');
	const active = project.status === 'active';
	const fileRef = useRef<HTMLInputElement>(null);
	const [kind, setKind] = useState<TEvidenceKind>('photo');
	const [file, setFile] = useState<File | null>(null);
	const [note, setNote] = useState('');
	const [busy, setBusy] = useState(false);

	const run = async (work: () => Promise<unknown>, done: string) => {
		setBusy(true);
		try {
			await work();
			await queryClient.invalidateQueries({ queryKey: ['projects'] });
			toast.success(done);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('projects:evidence.title')}</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-4'>
				<div className='flex flex-wrap gap-2 text-xs'>
					{(['testing', 'training', 'bast'] as const).map((required) => (
						<Badge key={required} variant={project.evidenceComplete[required] ? 'default' : 'outline'}>
							{project.evidenceComplete[required] ? '✓ ' : ''}
							{t(`projects:evidenceKind.${required}`)}
						</Badge>
					))}
				</div>
				{project.evidence.length === 0 ? (
					<p className='text-sm text-muted-foreground'>{t('projects:evidence.empty')}</p>
				) : (
					<ul className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
						{project.evidence.map((file) => {
							const label = `${t(`projects:evidenceKind.${file.kind}`)}: ${file.fileName}`;
							return (
								<li key={file.id} className='flex flex-col gap-1 rounded-md border p-2 text-sm'>
									{file.contentType.startsWith('image/') ? (
										<a href={file.url} target='_blank' rel='noreferrer'>
											<img src={file.url} alt={label} className='h-32 w-full rounded object-cover' />
										</a>
									) : (
										<a href={file.url} target='_blank' rel='noreferrer' className='flex h-32 items-center justify-center rounded bg-muted hover:underline'>
											PDF · {file.fileName}
										</a>
									)}
									<div className='font-medium'>{t(`projects:evidenceKind.${file.kind}`)}</div>
									{file.note && <div className='text-muted-foreground'>{file.note}</div>}
									<div className='text-xs text-muted-foreground'>
										{file.uploader?.name ?? '—'} · {formatDateTime(file.createdAt, i18n.language)}
									</div>
									{active && (canManage || file.uploadedBy === actorUserId) && (
										<Button
											variant='ghost'
											size='sm'
											className='self-start'
											disabled={busy}
											onClick={() => void run(() => removeEvidence(project.id, file.id), t('projects:evidence.removed'))}
										>
											{t('projects:evidence.remove')}
										</Button>
									)}
								</li>
							);
						})}
					</ul>
				)}
				{active && canUpload && (
					<form
						className='grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_2fr_2fr_auto] sm:items-end'
						onSubmit={(event) => {
							event.preventDefault();
							if (!file) return;
							void run(async () => {
								await uploadEvidence(project.id, { file, kind, note: note.trim() || undefined });
								setFile(null);
								setNote('');
								if (fileRef.current) fileRef.current.value = '';
							}, t('projects:evidence.uploaded'));
						}}
					>
						<Field>
							<FieldLabel htmlFor='evidence-kind'>{t('projects:evidence.kind')}</FieldLabel>
							<Select value={kind} onValueChange={(value: string | null) => setKind(value as TEvidenceKind)}>
								<SelectTrigger id='evidence-kind' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{EVIDENCE_KINDS.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`projects:evidenceKind.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='evidence-file'>{t('projects:evidence.file')}</FieldLabel>
							<Input
								ref={fileRef}
								id='evidence-file'
								type='file'
								required
								accept='image/jpeg,image/png,image/webp,application/pdf'
								onChange={(event) => setFile(event.target.files?.[0] ?? null)}
							/>
							<FieldDescription>{t('projects:evidence.hint')}</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor='evidence-note'>{t('projects:evidence.note')}</FieldLabel>
							<Input id='evidence-note' maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
						</Field>
						<Button type='submit' disabled={busy || !file}>
							{t('projects:evidence.upload')}
						</Button>
					</form>
				)}
			</CardContent>
		</Card>
	);
}
