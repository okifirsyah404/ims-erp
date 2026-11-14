import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { toast } from '@/components/toast';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Field,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { ImageDropzone } from '@/components/organization/image-dropzone';
import { encodeImage } from '@/lib/image-file';
import {
	createOrganization,
	organizationsQueryOptions,
	uploadOrganizationImage,
} from '@/lib/organization-api';

export const Route = createFileRoute('/_authed/organizations/new')({
	component: NewOrganizationPage,
});

/** Must match the backend `createOrganizationSchema.slug` rule. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

function NewOrganizationPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { t } = useTranslation(['admin', 'common']);

	const [name, setName] = useState('');
	const [slug, setSlug] = useState('');
	const [description, setDescription] = useState('');
	const [slugTouched, setSlugTouched] = useState(false);
	const [pending, setPending] = useState(false);
	const [uploading, setUploading] = useState(false);
	// Optional profile image: the endpoints are organization-id-scoped, so the
	// file is encoded and uploaded right after the organization exists.
	const [imageFile, setImageFile] = useState<File | null>(null);
	// Object URL preview for the picked image; revoked when it is replaced.
	const imagePreviewUrl = useMemo(
		() => (imageFile ? URL.createObjectURL(imageFile) : null),
		[imageFile],
	);
	useEffect(() => {
		if (!imagePreviewUrl) return;
		return () => URL.revokeObjectURL(imagePreviewUrl);
	}, [imagePreviewUrl]);

	const slugValid = SLUG_PATTERN.test(slug);
	const canSubmit = Boolean(name.trim()) && slugValid && !pending;

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canSubmit) return;
		setPending(true);
		try {
			const created = await createOrganization({
				name,
				slug,
				// Empty/whitespace-only clears it server-side; send nothing.
				description: description.trim() || undefined,
			});
			if (!created) throw new Error(t('common:error.failed'));

			// A failed logo upload must not lose the organization that was just
			// created: report it and keep the redirect.
			if (imageFile) {
				setUploading(true);
				try {
					const { blob } = await encodeImage(imageFile);
					await uploadOrganizationImage(created.organization.id, blob);
				} catch (error) {
					toast.error(
						error instanceof Error
							? error.message
							: t('common:error.failed'),
					);
				} finally {
					setUploading(false);
				}
			}

			toast.success(t('orgs.created'));
			// Better Auth activates the new organization for this session, so
			// the organization list AND the permission cache are both stale.
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: organizationsQueryOptions.queryKey,
				}),
				queryClient.invalidateQueries({ queryKey: ['erp-organizations'] }),
				queryClient.invalidateQueries({ queryKey: ['erp-has-permission'] }),
			]);
			void navigate({
				to: '/organizations/$organizationId',
				params: { organizationId: created.organization.id },
			});
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setPending(false);
		}
	}

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('orgs.newTitle')}</h1>
				<p className='text-sm text-muted-foreground'>
					{t('orgs.newDescription')}
				</p>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>{t('orgs.details')}</CardTitle>
					<CardDescription>{t('orgs.slugDescription')}</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						{/* Logo is an organization attribute, so it leads the form;
						    centered because it is the identity anchor of the card. */}
						<div className='mb-6 flex flex-col items-center gap-2'>
							<ImageDropzone
								previewUrl={imagePreviewUrl}
								busy={uploading}
								disabled={pending}
								label={t('orgImage.title')}
								hint={t('orgImage.dropHint')}
								onSelect={setImageFile}
								onReject={(reason) =>
									toast.error(
										t(
											reason === 'size'
												? 'orgImage.tooLarge'
												: 'orgImage.invalidType',
										),
									)
								}
							/>
							{/* The zone already shows the hint, so only the picked file
							    and its removal need a line of their own. */}
							{imageFile && (
								<>
									<p className='max-w-full truncate text-xs leading-snug text-muted-foreground'>
										{imageFile.name}
									</p>
									<Button
										type='button'
										variant='ghost'
										size='sm'
										disabled={pending}
										onClick={() => setImageFile(null)}
									>
										{t('orgImage.removeSelection')}
									</Button>
								</>
							)}
						</div>

						<FieldGroup>
							<Field>
								<FieldLabel htmlFor='name'>{t('orgs.name')}</FieldLabel>
								<Input
									id='name'
									value={name}
									required
									maxLength={200}
									disabled={pending}
									onChange={(event) => {
										setName(event.target.value);
										if (!slugTouched) setSlug(slugify(event.target.value));
									}}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='description'>
									{t('orgs.descriptionLabel')}
								</FieldLabel>
								<Textarea
									id='description'
									value={description}
									rows={4}
									maxLength={2000}
									disabled={pending}
									placeholder={t('orgs.descriptionPlaceholder')}
									onChange={(event) => setDescription(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='slug'>{t('orgs.slug')}</FieldLabel>
								<Input
									id='slug'
									value={slug}
									required
									pattern='[a-z0-9]+(-[a-z0-9]+)*'
									disabled={pending}
									aria-invalid={Boolean(slug) && !slugValid}
									onChange={(event) => {
										setSlugTouched(true);
										setSlug(event.target.value);
									}}
								/>
								<p className='text-xs text-muted-foreground'>
									{Boolean(slug) && !slugValid
										? t('orgs.slugInvalid')
										: `/organizations/${slug || '…'}`}
								</p>
							</Field>
						</FieldGroup>

						<div className='mt-6 flex items-center justify-end gap-2 border-t pt-4'>
							<Button
								type='button'
								variant='outline'
								disabled={pending}
								onClick={() => navigate({ to: '/organizations' })}
							>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' disabled={!canSubmit}>
								{pending ? t('orgs.creating') : t('orgs.create')}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
