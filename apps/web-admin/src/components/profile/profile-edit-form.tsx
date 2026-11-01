import { useRef, useState } from 'react';
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

	const [name, setName] = useState(user.name);
	const [username, setUsername] = useState(user.displayUsername ?? user.username ?? '');
	const [bio, setBio] = useState(user.bio ?? '');
	const [imageUrl, setImageUrl] = useState(user.image);
	const [formError, setFormError] = useState<string | null>(null);

	const saveMutation = useMutation({
		mutationFn: () => updateSelfUser({ name, username: username || undefined, bio: bio || undefined }),
		onSuccess: async () => {
			await invalidateSelfUser();
			toast.success('Profile updated');
			navigate({ to: '/profiles' });
		},
		onError: (error: Error) => setFormError(error.message),
	});

	const avatarMutation = useMutation({
		mutationFn: (file: File) => uploadSelfAvatar(file),
		onSuccess: async (updated) => {
			setImageUrl(updated.image);
			await invalidateSelfUser();
			toast.success('Avatar updated');
		},
		onError: (error: Error) => toast.error(error.message),
	});

	function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;
		if (!AVATAR_TYPES.includes(file.type)) {
			toast.error('Avatar must be a PNG, JPEG, or WebP image');
			return;
		}
		if (file.size > MAX_AVATAR_BYTES) {
			// Larger files are still allowed through: compression happens
			// before upload, and the 2 MiB cap applies to the compressed blob.
			// Only absurdly large files are rejected outright.
			if (file.size > 25 * MAX_AVATAR_BYTES) {
				toast.error('Image is too large (max 50 MiB)');
				return;
			}
		}
		avatarMutation.mutate(file);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Edit profile</CardTitle>
				<CardDescription>Update how you appear across the ERP</CardDescription>
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
								{avatarMutation.isPending ? 'Uploading…' : 'Change avatar'}
							</Button>
							<FieldDescription>PNG, JPEG, or WebP — compressed automatically.</FieldDescription>
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
								<FieldLabel htmlFor='edit-name'>Name</FieldLabel>
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
								<FieldLabel htmlFor='edit-username'>Username</FieldLabel>
								<Input
									id='edit-username'
									minLength={3}
									maxLength={30}
									value={username}
									onChange={(e) => setUsername(e.target.value)}
								/>
								<FieldDescription>3–30 characters; must be unique.</FieldDescription>
							</Field>
							<Field>
								<FieldLabel htmlFor='edit-bio'>Bio</FieldLabel>
								<Textarea
									id='edit-bio'
									maxLength={1000}
									rows={3}
									value={bio}
									onChange={(e) => setBio(e.target.value)}
								/>
								<FieldDescription>Up to 1000 characters.</FieldDescription>
							</Field>
							{formError && (
								<p className='text-destructive text-sm' role='alert'>
									{formError}
								</p>
							)}
							<div className='flex gap-2'>
								<Button type='submit' disabled={saveMutation.isPending}>
									{saveMutation.isPending ? 'Saving…' : 'Save changes'}
								</Button>
								<Button
									type='button'
									variant='ghost'
									render={<a href='/profiles' />}
								>
									Cancel
								</Button>
							</div>
						</FieldGroup>
					</form>
				</FieldGroup>
			</CardContent>
		</Card>
	);
}
