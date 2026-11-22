import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { toast } from '@/components/toast';
import { ImageDropzone } from '@/components/image-dropzone';
import {
	invalidateSelfUser,
	selfUserQueryOptions,
	updateSelfUser,
	uploadSelfAvatar,
} from '@/lib/user-api';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';

/** Backend `updateSelfUserSchema.bio` cap. */
const BIO_MAX = 1000;
/** Backend `updateSelfUserSchema.name` cap. */
const NAME_MAX = 120;

/**
 * Self profile editor — the whole `/profiles` page (ERP-0111; the read-only
 * detail view is gone).
 *
 * @remarks
 * The photo uses the same click-or-drop {@link ImageDropzone} as
 * `/organizations/new`: picking only previews; the upload
 * (`POST /users/me/avatar`) runs on Save together with the field update
 * (`PATCH /users/me`). Username and email are account settings and live on
 * `/accounts`; they are shown here read-only with a link.
 */
export function ProfileEditForm() {
	const { data: user } = useSuspenseQuery(selfUserQueryOptions);
	const { t } = useTranslation(['account', 'common']);

	const [name, setName] = useState(user.name);
	const [bio, setBio] = useState(user.bio ?? '');
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [pending, setPending] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	// Object URL preview for the picked image; revoked when it is replaced.
	const pickedPreviewUrl = useMemo(
		() => (imageFile ? URL.createObjectURL(imageFile) : null),
		[imageFile],
	);
	useEffect(() => {
		if (!pickedPreviewUrl) return;
		return () => URL.revokeObjectURL(pickedPreviewUrl);
	}, [pickedPreviewUrl]);

	const dirty =
		name !== user.name || bio !== (user.bio ?? '') || imageFile !== null;
	const canSubmit = dirty && Boolean(name.trim()) && !pending;

	function discard() {
		setName(user.name);
		setBio(user.bio ?? '');
		setImageFile(null);
		setFormError(null);
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canSubmit) return;
		setFormError(null);
		setPending(true);
		try {
			const fieldsChanged = name !== user.name || bio !== (user.bio ?? '');
			// An empty bio is sent as '' so clearing it actually clears it.
			if (fieldsChanged) await updateSelfUser({ name: name.trim(), bio });
			if (imageFile) {
				await uploadSelfAvatar(imageFile);
				setImageFile(null);
			}
			await invalidateSelfUser();
			toast.success(t('profile.updated'));
		} catch (error) {
			setFormError(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setPending(false);
		}
	}

	const username = user.displayUsername ?? user.username;

	return (
		<form onSubmit={handleSubmit}>
			<Card size='sm'>
				<CardHeader>
					<CardTitle>{t('profile.title')}</CardTitle>
					<CardDescription>{t('profile.description')}</CardDescription>
				</CardHeader>
				<CardContent>
					<div className='flex flex-col gap-5 sm:flex-row sm:items-start'>
						{/* Photo leads, like the organization form; on wide screens it
						    sits beside the fields instead of above them. */}
						<div className='flex flex-col items-center gap-1.5 sm:w-36'>
							<ImageDropzone
								previewUrl={pickedPreviewUrl ?? user.image}
								busy={pending && imageFile !== null}
								disabled={pending}
								label={t('profile.photo')}
								hint={t('profile.photoHint')}
								onSelect={setImageFile}
								onReject={(reason) =>
									toast.error(
										t(
											reason === 'size'
												? 'profile.avatarTooLarge'
												: 'profile.avatarInvalidType',
										),
									)
								}
							/>
							{imageFile && (
								<>
									<p className='max-w-full truncate text-xs text-muted-foreground'>
										{imageFile.name}
									</p>
									<Button
										type='button'
										variant='ghost'
										size='xs'
										disabled={pending}
										onClick={() => setImageFile(null)}
									>
										{t('profile.removeSelection')}
									</Button>
								</>
							)}
						</div>

						<FieldGroup className='flex-1 gap-4'>
							<Field>
								<FieldLabel htmlFor='profile-name'>{t('profile.name')}</FieldLabel>
								<Input
									id='profile-name'
									required
									maxLength={NAME_MAX}
									value={name}
									disabled={pending}
									autoComplete='name'
									onChange={(event) => setName(event.target.value)}
								/>
							</Field>
							<Field>
								<div className='flex items-baseline justify-between gap-2'>
									<FieldLabel htmlFor='profile-bio'>{t('profile.bio')}</FieldLabel>
									<span
										className='text-xs tabular-nums text-muted-foreground'
										aria-live='polite'
									>
										{t('profile.bioCount', { count: bio.length, max: BIO_MAX })}
									</span>
								</div>
								<Textarea
									id='profile-bio'
									rows={4}
									maxLength={BIO_MAX}
									value={bio}
									disabled={pending}
									placeholder={t('profile.bioPlaceholder')}
									onChange={(event) => setBio(event.target.value)}
								/>
							</Field>
							<div className='grid gap-x-6 gap-y-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)]'>
								<div className='min-w-0'>
									<p className='text-xs text-muted-foreground'>
										{t('profile.username')}
									</p>
									<p className='truncate font-medium'>
										{username ? `@${username}` : '—'}
									</p>
								</div>
								<div className='min-w-0'>
									<p className='text-xs text-muted-foreground'>
										{t('profile.email')}
									</p>
									<div className='flex min-w-0 items-center gap-1.5'>
										<span className='truncate font-medium'>{user.email}</span>
										<Badge
											variant={user.emailVerified ? 'secondary' : 'outline'}
											className='shrink-0'
										>
											{user.emailVerified
												? t('email.verified')
												: t('email.unverified')}
										</Badge>
									</div>
								</div>
								<FieldDescription className='sm:col-span-2'>
									<Link to='/accounts'>{t('profile.manageInAccount')}</Link>
								</FieldDescription>
							</div>
							{formError && (
								<p className='text-sm text-destructive' role='alert'>
									{formError}
								</p>
							)}
						</FieldGroup>
					</div>
				</CardContent>
				<CardFooter className='justify-end gap-2'>
					<Button
						type='button'
						variant='ghost'
						disabled={!dirty || pending}
						onClick={discard}
					>
						{t('profile.discard')}
					</Button>
					<Button type='submit' disabled={!canSubmit}>
						{pending ? t('form.saving') : t('profile.saveChanges')}
					</Button>
				</CardFooter>
			</Card>
		</form>
	);
}
