import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/toast';
import { Button } from '@ims-erp/ui/components/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { ImageDropzone } from '@/components/organization/image-dropzone';
import { encodeImage } from '@/lib/image-file';
import {
	createOrganization,
	myOrganizationsQueryOptions,
	organizationsQueryOptions,
	uploadOrganizationImage,
} from '@/lib/organization-api';

/** Must match the backend `createOrganizationSchema.slug` rule. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

type CreateOrganizationDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/**
 * Create-organization dialog, opened from the organizations list and the
 * sidebar switcher.
 *
 * @remarks
 * Application admins only: callers gate the trigger, the backend enforces it.
 * The form state is held by an inner component that is only mounted while the
 * dialog is open, so every open starts from a blank form.
 */
export function CreateOrganizationDialog({
	open,
	onOpenChange,
}: CreateOrganizationDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{open && <CreateOrganizationDialogBody onOpenChange={onOpenChange} />}
		</Dialog>
	);
}

function CreateOrganizationDialogBody({
	onOpenChange,
}: Pick<CreateOrganizationDialogProps, 'onOpenChange'>) {
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
			// the organization lists AND the permission cache are all stale.
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: organizationsQueryOptions.queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: myOrganizationsQueryOptions.queryKey,
				}),
				queryClient.invalidateQueries({ queryKey: ['erp-organizations'] }),
				queryClient.invalidateQueries({ queryKey: ['erp-has-permission'] }),
			]);
			onOpenChange(false);
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
		<DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
			<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
				<DialogHeader>
					<DialogTitle>{t('orgs.newTitle')}</DialogTitle>
					<DialogDescription>{t('orgs.newDescription')}</DialogDescription>
				</DialogHeader>

				<div className='flex flex-col items-center gap-2'>
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
						<FieldLabel htmlFor='new-org-name'>{t('orgs.name')}</FieldLabel>
						<Input
							id='new-org-name'
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
						<FieldLabel htmlFor='new-org-description'>
							{t('orgs.descriptionLabel')}
						</FieldLabel>
						<Textarea
							id='new-org-description'
							value={description}
							rows={4}
							maxLength={2000}
							disabled={pending}
							placeholder={t('orgs.descriptionPlaceholder')}
							onChange={(event) => setDescription(event.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor='new-org-slug'>{t('orgs.slug')}</FieldLabel>
						<Input
							id='new-org-slug'
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
								: `/organizations/${slug || '…'} · ${t('orgs.slugDescription')}`}
						</p>
					</Field>
				</FieldGroup>

				<DialogFooter>
					<Button
						type='button'
						variant='outline'
						disabled={pending}
						onClick={() => onOpenChange(false)}
					>
						{t('common:action.cancel')}
					</Button>
					<Button type='submit' disabled={!canSubmit}>
						{pending ? t('orgs.creating') : t('orgs.create')}
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	);
}
