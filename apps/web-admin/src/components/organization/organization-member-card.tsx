import { useTranslation } from 'react-i18next';
import { erpRoleLabel } from '@ims-erp/common';

import { Avatar, AvatarFallback, AvatarImage } from '@ims-erp/ui/components/avatar';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card } from '@ims-erp/ui/components/card';
import { Link } from '@tanstack/react-router';

export interface OrganizationMemberCardProps {
	member: {
		id: string;
		userId: string;
		role: string;
		createdAt: string | Date;
		user?: {
			name?: string | null;
			email?: string | null;
			image?: string | null;
		} | null;
	};
	organizationId: string;
}

/**
 * Card representation of a single organization member.
 *
 * @remarks
 * Compact card for the members grid on the organization detail page (6
 * columns on wide screens). Identity first (avatar, name, email), then role
 * badge and join date, with a small edit action. Plain flex containers are
 * used instead of `CardHeader` — its shadcn base class is `grid`, which
 * stacks the avatar and name block vertically (observed in Firefox).
 */
export function OrganizationMemberCard({
	member,
	organizationId,
}: OrganizationMemberCardProps) {
	const { t, i18n } = useTranslation(['admin', 'common']);

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
		<Card className='gap-2 py-3'>
			<div className='flex items-center gap-2.5 px-3'>
				<Avatar className='size-9 shrink-0'>
					{member.user?.image ? (
						<AvatarImage src={member.user.image} alt={displayName} />
					) : null}
					<AvatarFallback>{initials || '?'}</AvatarFallback>
				</Avatar>
				<div className='min-w-0 flex-1'>
					<p className='truncate font-medium leading-tight'>{displayName}</p>
					<p className='truncate text-xs text-muted-foreground'>{email}</p>
				</div>
			</div>
			<div className='flex items-center justify-between gap-2 px-3'>
				<Badge variant='outline' className='min-w-0 max-w-[130px] truncate'>
					{erpRoleLabel(member.role, i18n.language)}
				</Badge>
				<span className='shrink-0 text-xs text-muted-foreground'>
					{new Date(member.createdAt).toLocaleDateString()}
				</span>
			</div>
			<Button
				variant='ghost'
				size='sm'
				className='mx-1 h-7 justify-start text-xs text-muted-foreground'
				render={
					<Link
						to='/organizations/$organizationId/members/$memberId/edit'
						params={{ organizationId, memberId: member.id }}
					/>
				}
			>
				{t('common:action.edit')}
			</Button>
		</Card>
	);
}
