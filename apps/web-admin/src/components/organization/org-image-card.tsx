import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/toast';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	deleteOrganizationImage,
	encodeWebp,
	getOrganizationImage,
	organizationQueryOptions,
	uploadOrganizationImage,
} from '@/lib/organization-api';
import { ImageDropzone } from './image-dropzone';

/**
 * Organization profile image card (ERP-0041): upload (client encodes WebP),
 * replace, and clear. Read shows the presigned URL — refreshed on each
 * mount since presigned GETs expire.
 */
export function OrganizationImageCard({
	organizationId,
	canUpdate,
}: {
	organizationId: string;
	canUpdate: boolean;
}) {
	const { t } = useTranslation(['admin', 'common']);
	const queryClient = useQueryClient();
	const [uploading, setUploading] = useState(false);

	const { data: imageUrl } = useQuery({
		queryKey: ['org-image', organizationId],
		queryFn: () => getOrganizationImage(organizationId),
		staleTime: 60_000,
	});

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ['org-image', organizationId] });
		queryClient.invalidateQueries({
			queryKey: organizationQueryOptions(organizationId).queryKey,
		});
	};

	async function handleFile(file: File) {
		setUploading(true);
		try {
			let webp: Blob;
			try {
				webp = await encodeWebp(file);
			} catch {
				// Undecodable source (HEIC, corrupt bytes): the browser never
				// produced a bitmap, so the server was not involved.
				toast.error(t('orgImage.decodeFailed'));
				return;
			}
			await uploadOrganizationImage(organizationId, webp);
			toast.success(t('orgImage.uploaded'));
			invalidate();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setUploading(false);
		}
	}

	async function handleClear() {
		try {
			await deleteOrganizationImage(organizationId);
			toast.success(t('orgImage.cleared'));
			invalidate();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		}
	}

	return (
		<Card className='max-w-xl'>
			<CardHeader>
				<CardTitle>{t('orgImage.title')}</CardTitle>
				<CardDescription>{t('orgImage.description')}</CardDescription>
			</CardHeader>
			<CardContent className='flex items-center gap-4'>
				<ImageDropzone
					previewUrl={imageUrl ?? null}
					disabled={!canUpdate}
					busy={uploading}
					label={t('orgImage.title')}
					hint={t('orgImage.dropHint')}
					onSelect={(file) => void handleFile(file)}
					onReject={(reason) =>
						toast.error(
							t(reason === 'size' ? 'orgImage.tooLarge' : 'orgImage.invalidType'),
						)
					}
				/>
				{canUpdate && (
					<div className='flex flex-col gap-2'>
						{/* The zone shows the pick hint when empty; once an image
						    exists only the replace hint and Delete are needed. */}
						{uploading ? (
							<p className='text-xs text-muted-foreground'>
								{t('orgImage.uploading')}
							</p>
						) : (
							imageUrl && (
								<p className='text-xs text-muted-foreground'>
									{t('orgImage.replaceHint')}
								</p>
							)
						)}
						{imageUrl && (
							<Button
								type='button'
								variant='ghost'
								size='sm'
								className='self-start'
								disabled={uploading}
								onClick={() => void handleClear()}
							>
								{t('common:action.delete')}
							</Button>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
