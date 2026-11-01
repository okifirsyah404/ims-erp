import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { selfUserQueryOptions } from '@/lib/user-api';
import { Avatar, AvatarFallback, AvatarImage } from '@ims-erp/ui/components/avatar';
import { Badge } from '@ims-erp/ui/components/badge';
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

/**
 * Read-only self profile (`/profiles`). Data comes from `GET /users/me`
 * (`selfUserQueryOptions`) — the backend is authoritative and presigns the
 * avatar URL per request.
 */
export function ProfileView() {
	const { data: user } = useSuspenseQuery(selfUserQueryOptions);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Profile</CardTitle>
				<CardDescription>
					Your account information as visible to the organization
				</CardDescription>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<div className='flex items-center gap-4'>
						<Avatar className='size-16'>
							{user.image && <AvatarImage src={user.image} alt={user.name} />}
							<AvatarFallback>
								{user.name
									.split(' ')
									.map((part) => part[0])
									.slice(0, 2)
									.join('')
									.toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div>
							<p className='font-medium'>{user.name}</p>
							<p className='text-muted-foreground text-sm'>
								{user.displayUsername ?? user.username ?? '—'}
							</p>
						</div>
					</div>
					<Field>
						<FieldLabel htmlFor='profile-name'>Name</FieldLabel>
						<Input id='profile-name' value={user.name} readOnly />
					</Field>
					<Field>
						<FieldLabel htmlFor='profile-username'>Username</FieldLabel>
						<Input
							id='profile-username'
							value={user.displayUsername ?? user.username ?? ''}
							readOnly
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor='profile-email'>Email</FieldLabel>
						<div className='flex items-center gap-2'>
							<Input
								id='profile-email'
								value={user.email}
								readOnly
								className='flex-1'
							/>
							<Badge variant={user.emailVerified ? 'secondary' : 'outline'}>
								{user.emailVerified ? 'Verified' : 'Unverified'}
							</Badge>
						</div>
					</Field>
					<Field>
						<FieldLabel htmlFor='profile-bio'>Bio</FieldLabel>
						<Input id='profile-bio' value={user.bio ?? ''} readOnly />
					</Field>
					<div>
						<Button render={<Link to='/profiles/edit' />}>
							Edit profile
						</Button>
					</div>
				</FieldGroup>
			</CardContent>
		</Card>
	);
}
