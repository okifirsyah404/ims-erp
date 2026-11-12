import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
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
	const fileInput = useRef<HTMLInputElement>(null);
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

	async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;
		setUploading(true);
		try {
			const webp = await encodeWebp(file);
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
				{imageUrl ? (
					<img
						src={imageUrl}
						alt={t('orgImage.title')}
						className='h-16 w-16 rounded-md object-cover border'
					/>
				) : (
					<div className='h-16 w-16 rounded-md border border-dashed grid place-items-center text-xs text-muted-foreground'>
						—
					</div>
				)}
				{canUpdate && (
					<div className='flex flex-wrap gap-2'>
						<input
							ref={fileInput}
							type='file'
							accept='image/*'
							hidden
							onChange={handleFile}
						/>
						<Button
							type='button'
							variant='outline'
							size='sm'
							disabled={uploading}
							onClick={() => fileInput.current?.click()}
						>
							{uploading
								? t('orgImage.uploading')
								: imageUrl
									? t('orgImage.replace')
									: t('orgImage.upload')}
						</Button>
						{imageUrl && (
							<Button
								type='button'
								variant='ghost'
								size='sm'
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
