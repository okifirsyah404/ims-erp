import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
	createFileRoute,
	useNavigate,
	useParams,
} from '@tanstack/react-router';
import { ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { Field, FieldGroup } from '@ims-erp/ui/components/field';
import { FieldLabel } from '@/components/form/field-label';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import {
	deleteOrganizationImage,
	getOrganizationImage,
	organizationQueryOptions,
	uploadOrganizationImage,
	updateOrganization,
} from '@/lib/organization-api';
import { encodeImage } from '@/lib/image-file';
import { ImageDropzone } from '@/components/image-dropzone';

export const Route = createFileRoute('/_authed/organizations/$organizationId/edit')(
	{
		component: EditOrganizationPage,
	},
);

function EditOrganizationPage() {
	const { organizationId } = useParams({ from: Route.id });
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { t } = useTranslation(['admin', 'common']);
	const { data: organization, isPending, isError, error } = useQuery({
		...organizationQueryOptions(organizationId),
		retry: false,
	});

	const [name, setName] = useState(organization?.name ?? '');
	const [description, setDescription] = useState(
		organization?.description ?? '',
	);
	const [pending, setPending] = useState(false);
	const [loadedName, setLoadedName] = useState<string | null>(null);

	if (organization && loadedName === null) {
		setName(organization.name);
		setDescription(organization.description ?? '');
		setLoadedName(organization.name);
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);
		try {
			await updateOrganization(organizationId, {
				name,
				// An empty string clears the description server-side.
				description: description.trim(),
			});
			toast.success(t('orgEdit.saved'));
			await queryClient.invalidateQueries({
				queryKey: organizationQueryOptions(organizationId).queryKey,
			});
			void navigate({
				to: '/organizations/$organizationId',
				params: { organizationId },
			});
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setPending(false);
		}
	}

	if (isPending) return <PageSkeleton cards={1} />;
	if (isError) return <ErrorState error={error} bordered />;

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('orgEdit.title')}</h1>
				<p className='text-sm text-muted-foreground'>
					{t('orgEdit.description')}
				</p>
			</div>
			<form onSubmit={handleSubmit}>
			<Card>
				<CardHeader>
					<CardTitle>{t('orgEdit.details')}</CardTitle>
					<CardDescription>{t('orgImage.description')}</CardDescription>
				</CardHeader>
				<CardContent>
						{/* Matches the create page: the logo leads the form, centered
						    because it is the identity anchor of the card. The upload
						    is immediate (the org exists), so the picker binds to the
						    org's presigned image instead of a local file. */}
						<div className='mb-6 flex flex-col items-center gap-2'>
							<EditImagePicker organizationId={organizationId} />
						</div>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor='name'>{t('orgEdit.name')}</FieldLabel>
								<Input
									id='name'
									value={name}
									required
									maxLength={200}
									onChange={(event) => setName(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='description' optional>
									{t('orgs.descriptionLabel')}
								</FieldLabel>
								<Textarea
									id='description'
									value={description}
									rows={4}
									maxLength={2000}
									placeholder={t('orgs.descriptionPlaceholder')}
									onChange={(event) => setDescription(event.target.value)}
								/>
							</Field>
						</FieldGroup>
				</CardContent>
				<CardFooter className='justify-end gap-2'>
					<Button type='submit' disabled={pending || !name}>
						{pending
							? t('common:action.saving')
							: t('common:action.save')}
					</Button>
					<Button
						type='button'
						variant='outline'
						onClick={() =>
							navigate({
								to: '/organizations/$organizationId',
								params: { organizationId },
							})
						}
					>
						{t('common:action.cancel')}
					</Button>
				</CardFooter>
			</Card>
			</form>
		</div>
	);
}

/**
 * Centered logo picker for the edit page, mirroring the create page's
 * centered zone. Unlike create, the organization already exists, so a pick
 * encodes and uploads immediately (the same flow the old image card used),
 * and an existing image can be cleared.
 */
function EditImagePicker({ organizationId }: { organizationId: string }) {
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
			// Undecodable source (corrupt bytes, format this browser cannot
			// render): the server was never reached.
			const encoded = await encodeImage(file).catch(() => null);
			if (!encoded) {
				toast.error(t('orgImage.decodeFailed'));
				return;
			}
			await uploadOrganizationImage(organizationId, encoded.blob);
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
		<>
			<ImageDropzone
				previewUrl={imageUrl ?? null}
				busy={uploading}
				label={t('orgImage.title')}
				hint={imageUrl ? t('orgImage.replaceHint') : t('orgImage.dropHint')}
				onSelect={(file) => void handleFile(file)}
				onReject={(reason) =>
					toast.error(
						t(reason === 'size' ? 'orgImage.tooLarge' : 'orgImage.invalidType'),
					)
				}
			/>
			{imageUrl && (
				<Button
					type='button'
					variant='ghost'
					size='sm'
					disabled={uploading}
					onClick={() => void handleClear()}
				>
					{t('common:action.delete')}
				</Button>
			)}
		</>
	);
}
