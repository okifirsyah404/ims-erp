import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@ims-erp/ui/components/alert';
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
import { EmptyState, ErrorState } from '@/components/empty-state';
import { ImageDropzone } from '@/components/image-dropzone';
import { SectionSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { encodeImage } from '@/lib/image-file';
import {
	deleteOrganizationImage,
	getOrganizationImage,
	organizationQueryOptions,
	updateOrganization,
	uploadOrganizationImage,
} from '@/lib/organization-api';
import { useActiveOrganizationId } from '@/lib/use-active-organization';
import { usePermission } from '@/lib/use-permission';

/**
 * `/settings/organizations` — the company organization profile.
 *
 * @remarks
 * The ERP uses exactly one organization (K12, M12-2), so there is no list, no
 * create and no delete: this page edits the active organization's profile
 * (name, description, logo) and nothing else. Members and their roles moved to
 * `/admin/users` (M12-14). The backend still enforces `organization:update`
 * and the record's own membership.
 */
export const Route = createFileRoute('/_authed/settings/organizations/')({
	component: OrganizationSettingsPage,
});

function OrganizationSettingsPage() {
	const { t } = useTranslation(['settings', 'common']);
	const organizationId = useActiveOrganizationId();
	const canEdit = usePermission('organization.update');

	if (organizationId === null) {
		return (
			<div className='flex flex-col gap-6'>
				<div>
					<h1 className='text-2xl font-bold'>
						{t('settings:organizationSettings.title')}
					</h1>
					<p className='text-sm text-muted-foreground'>
						{t('settings:organizationSettings.description')}
					</p>
				</div>
				<EmptyState
					title={t('settings:organizationSettings.noOrganization')}
					bordered
				/>
			</div>
		);
	}

	return (
		<OrganizationProfileCard
			organizationId={organizationId}
			canEdit={canEdit}
		/>
	);
}

function OrganizationProfileCard({
	organizationId,
	canEdit,
}: {
	organizationId: string;
	canEdit: boolean;
}) {
	const { t } = useTranslation(['settings', 'common']);
	const queryClient = useQueryClient();
	const { data: organization, isPending, isError, error } = useQuery({
		...organizationQueryOptions(organizationId),
		retry: false,
	});

	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [loaded, setLoaded] = useState(false);
	const [pending, setPending] = useState(false);

	// Seed the form once per loaded row; a refetch must not clobber typing.
	if (organization && !loaded) {
		setName(organization.name);
		setDescription(organization.description ?? '');
		setLoaded(true);
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
			toast.success(t('settings:organizationSettings.saved'));
			await queryClient.invalidateQueries({
				queryKey: organizationQueryOptions(organizationId).queryKey,
			});
		} catch (cause) {
			toast.error(
				cause instanceof Error ? cause.message : t('common:error.failed'),
			);
		} finally {
			setPending(false);
		}
	}

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>
					{t('settings:organizationSettings.title')}
				</h1>
				<p className='text-sm text-muted-foreground'>
					{t('settings:organizationSettings.description')}
				</p>
			</div>

			{isPending ? (
				<SectionSkeleton lines={6} />
			) : isError ? (
				<ErrorState error={error} bordered />
			) : (
				<>
					{!canEdit && (
						<Alert>
							<AlertDescription>
								{t('settings:organizationSettings.readOnly')}
							</AlertDescription>
						</Alert>
					)}
					<form onSubmit={handleSubmit}>
						<Card>
							<CardHeader>
								<CardTitle>
									{t('settings:organizationSettings.details')}
								</CardTitle>
								<CardDescription>
									{t('settings:organizationSettings.membersHint')}
								</CardDescription>
							</CardHeader>
							<CardContent className='flex flex-col gap-6'>
								<div className='flex flex-col items-center gap-2'>
									<OrganizationLogoPicker
										organizationId={organizationId}
										disabled={!canEdit}
									/>
								</div>
								<FieldGroup>
									<Field>
										<FieldLabel htmlFor='organization-name'>
											{t('settings:organizationSettings.name')}
										</FieldLabel>
										<Input
											id='organization-name'
											value={name}
											required
											disabled={!canEdit}
											maxLength={200}
											onChange={(event) => setName(event.target.value)}
										/>
										<p className='text-xs text-muted-foreground'>
											{t('settings:organizationSettings.nameHint')}
										</p>
									</Field>
									<Field>
										<FieldLabel htmlFor='organization-description' optional>
											{t('settings:organizationSettings.descriptionLabel')}
										</FieldLabel>
										<Textarea
											id='organization-description'
											value={description}
											rows={4}
											disabled={!canEdit}
											maxLength={2000}
											placeholder={t(
												'settings:organizationSettings.descriptionPlaceholder',
											)}
											onChange={(event) => setDescription(event.target.value)}
										/>
									</Field>
									<Field>
										<FieldLabel htmlFor='organization-slug'>
											{t('settings:organizationSettings.slug')}
										</FieldLabel>
										<Input
											id='organization-slug'
											value={organization?.slug ?? ''}
											readOnly
											disabled
										/>
										<p className='text-xs text-muted-foreground'>
											{t('settings:organizationSettings.slugHint')}
										</p>
									</Field>
								</FieldGroup>
							</CardContent>
							<CardFooter className='justify-end gap-2'>
								<Button
									type='submit'
									disabled={pending || !canEdit || !name.trim()}
								>
									{pending
										? t('common:action.saving')
										: t('common:action.save')}
								</Button>
							</CardFooter>
						</Card>
					</form>
				</>
			)}
		</div>
	);
}

/**
 * Logo picker: the organization exists, so a pick encodes and uploads
 * immediately (the create-time dialog is gone with K12).
 */
function OrganizationLogoPicker({
	organizationId,
	disabled,
}: {
	organizationId: string;
	disabled: boolean;
}) {
	const { t } = useTranslation(['settings', 'common']);
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
			// Undecodable source: the server was never reached.
			const encoded = await encodeImage(file).catch(() => null);
			if (!encoded) {
				toast.error(t('settings:organizationSettings.imageInvalid'));
				return;
			}
			await uploadOrganizationImage(organizationId, encoded.blob);
			toast.success(t('settings:organizationSettings.imageSaved'));
			invalidate();
		} catch (cause) {
			toast.error(
				cause instanceof Error ? cause.message : t('common:error.failed'),
			);
		} finally {
			setUploading(false);
		}
	}

	async function handleClear() {
		try {
			await deleteOrganizationImage(organizationId);
			toast.success(t('settings:organizationSettings.imageCleared'));
			invalidate();
		} catch (cause) {
			toast.error(
				cause instanceof Error ? cause.message : t('common:error.failed'),
			);
		}
	}

	return (
		<>
			<ImageDropzone
				previewUrl={imageUrl ?? null}
				busy={uploading}
				disabled={disabled}
				label={t('settings:organizationSettings.image')}
				hint={t('settings:organizationSettings.imageHint')}
				onSelect={(file) => void handleFile(file)}
				onReject={() =>
					toast.error(t('settings:organizationSettings.imageHint'))
				}
			/>
			{imageUrl && !disabled && (
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
