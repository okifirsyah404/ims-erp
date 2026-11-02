import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/components/toast';
import {
	invalidateSelfUser,
	selfUserQueryOptions,
	updateSelfUser,
	uploadSelfAvatar,
} from '@/lib/user-api';
import { Avatar, AvatarFallback, AvatarImage } from '@ims-erp/ui/components/avatar';
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
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';

/** Client-side pre-check mirroring the backend rules (UX only). */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Self profile editor (`/profiles/edit`). Avatar uploads go through
 * `POST /users/me/avatar` (compressed client-side first); fields save via
 * `PATCH /users/me`.
 */
export function ProfileEditForm() {
	const { data: user } = useSuspenseQuery(selfUserQueryOptions);
	const navigate = useNavigate();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { t } = useTranslation(['account', 'common']);

	const [name, setName] = useState(user.name);
	const [username, setUsername] = useState(user.displayUsername ?? user.username ?? '');
	const [bio, setBio] = useState(user.bio ?? '');
	const [imageUrl, setImageUrl] = useState(user.image);
	const [formError, setFormError] = useState<string | null>(null);

	const saveMutation = useMutation({
		mutationFn: () => updateSelfUser({ name, username: username || undefined, bio: bio || undefined }),
		onSuccess: async () => {
			await invalidateSelfUser();
			toast.success(t('profile.updated'));
			navigate({ to: '/profiles' });
		},
		onError: (error: Error) => setFormError(error.message),
	});

	const avatarMutation = useMutation({
		mutationFn: (file: File) => uploadSelfAvatar(file),
		onSuccess: async (updated) => {
			setImageUrl(updated.image);
			await invalidateSelfUser();
			toast.success(t('profile.avatarUpdated'));
		},
		onError: (error: Error) => toast.error(error.message),
	});

	function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;
		if (!AVATAR_TYPES.includes(file.type)) {
			toast.error(t('profile.avatarInvalidType'));
			return;
		}
		if (file.size > MAX_AVATAR_BYTES) {
			// Larger files are still allowed through: compression happens
			// before upload, and the 2 MiB cap applies to the compressed blob.
			// Only absurdly large files are rejected outright.
			if (file.size > 25 * MAX_AVATAR_BYTES) {
				toast.error(t('profile.avatarTooLarge'));
				return;
			}
		}
		avatarMutation.mutate(file);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('profile.editTitle')}</CardTitle>
				<CardDescription>{t('profile.editDescription')}</CardDescription>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<div className='flex items-center gap-4'>
						<Avatar className='size-16'>
							{imageUrl && <AvatarImage src={imageUrl} alt={name} />}
							<AvatarFallback>
								{name
									.split(' ')
									.map((part) => part[0])
									.slice(0, 2)
									.join('')
									.toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div className='flex flex-col gap-1'>
							<input
								ref={fileInputRef}
								type='file'
								accept='image/png,image/jpeg,image/webp'
								className='hidden'
								onChange={handleAvatarChange}
							/>
							<Button
								type='button'
								variant='outline'
								onClick={() => fileInputRef.current?.click()}
								disabled={avatarMutation.isPending}
							>
								{avatarMutation.isPending
									? t('profile.uploading')
									: t('profile.changeAvatar')}
							</Button>
							<FieldDescription>{t('profile.avatarHint')}</FieldDescription>
						</div>
					</div>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							setFormError(null);
							saveMutation.mutate();
						}}
					>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor='edit-name'>{t('profile.name')}</FieldLabel>
								<Input
									id='edit-name'
									required
									minLength={1}
									maxLength={120}
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor='edit-username'>
									{t('profile.username')}
								</FieldLabel>
								<Input
									id='edit-username'
									minLength={3}
									maxLength={30}
									value={username}
									onChange={(e) => setUsername(e.target.value)}
								/>
								<FieldDescription>{t('profile.bioHint')}</FieldDescription>
							</Field>
							<Field>
								<FieldLabel htmlFor='edit-bio'>{t('profile.bio')}</FieldLabel>
								<Textarea
									id='edit-bio'
									maxLength={1000}
									rows={3}
									value={bio}
									onChange={(e) => setBio(e.target.value)}
								/>
								<FieldDescription>{t('profile.bioHint')}</FieldDescription>
							</Field>
							{formError && (
								<p className='text-destructive text-sm' role='alert'>
									{formError}
								</p>
							)}
							<div className='flex gap-2'>
								<Button type='submit' disabled={saveMutation.isPending}>
									{saveMutation.isPending
										? t('form.saving')
										: t('profile.saveChanges')}
								</Button>
								<Button
									type='button'
									variant='ghost'
									render={<a href='/profiles' />}
								>
									{t('common:action.cancel')}
								</Button>
							</div>
						</FieldGroup>
					</form>
				</FieldGroup>
			</CardContent>
		</Card>
	);
}
