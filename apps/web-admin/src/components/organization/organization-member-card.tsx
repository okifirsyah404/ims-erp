import { useTranslation } from 'react-i18next';

import { Avatar, AvatarFallback } from '@ims-erp/ui/components/avatar';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from '@ims-erp/ui/components/card';
import { Link } from '@tanstack/react-router';

export interface OrganizationMemberCardProps {
	member: {
		id: string;
		userId: string;
		role: string;
		createdAt: string | Date;
		user?: { name?: string | null; email?: string | null } | null;
	};
	organizationId: string;
}

/**
 * Card representation of a single organization member.
 *
 * @remarks
 * Displays the member identity (avatar, name, email), role badge, join date,
 * and an edit action. Used by the members grid on the organization detail
 * page instead of a table row.
 */
export function OrganizationMemberCard({
	member,
	organizationId,
}: OrganizationMemberCardProps) {
	const { t } = useTranslation(['admin', 'common']);

	const displayName = member.user?.name ?? member.userId;
	const email = member.user?.email ?? '—';
	const initials = displayName
		.split(' ')
		.map((part) => part[0])
		.filter(Boolean)
		.slice(0, 2)
		.join('')
		.toUpperCase();

	return (
		<Card className='gap-3 py-4'>
			<CardHeader className='flex-row items-center gap-3'>
				<Avatar className='size-10'>
					<AvatarFallback>{initials || '?'}</AvatarFallback>
				</Avatar>
				<div className='min-w-0 flex-1'>
					<p className='truncate font-medium leading-tight'>{displayName}</p>
					<p className='truncate text-sm text-muted-foreground'>{email}</p>
				</div>
			</CardHeader>
			<CardContent className='flex flex-col gap-1.5 text-sm'>
				<div className='flex items-center justify-between gap-2'>
					<span className='text-muted-foreground'>
						{t('orgDetail.memberRole')}
					</span>
					<Badge variant='outline'>{member.role}</Badge>
				</div>
				<div className='flex items-center justify-between gap-2'>
					<span className='text-muted-foreground'>
						{t('orgDetail.memberJoined')}
					</span>
					<span>{new Date(member.createdAt).toLocaleDateString()}</span>
				</div>
			</CardContent>
			<CardFooter>
				<Button
					variant='ghost'
					size='sm'
					className='ml-auto'
					render={
						<Link
							to='/organizations/$organizationId/members/$memberId/edit'
							params={{ organizationId, memberId: member.id }}
						/>
					}
				>
					{t('common:action.edit')}
				</Button>
			</CardFooter>
		</Card>
	);
}
