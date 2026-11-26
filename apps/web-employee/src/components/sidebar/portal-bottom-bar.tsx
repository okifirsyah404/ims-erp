import { Link } from '@tanstack/react-router';
import { MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@ims-erp/ui/components/sheet';
import { cn } from 'cn';
import { liveNavItems } from './portal-nav';

/**
 * Mobile navigation: the `mobile` destinations as a bottom bar, the rest behind
 * "More".
 *
 * @remarks
 * The desktop rail is unusable on a phone (a drawer covers the content and the
 * thumb cannot reach the top of the screen), so the primary destinations stay
 * pinned within thumb reach. Rendered only below `md`. The sheet reuses the same
 * `liveNavItems`, so a hidden page can never leak into it.
 */
export function PortalBottomBar() {
	const { t } = useTranslation('nav');
	const primary = liveNavItems.filter((item) => item.mobile);
	const rest = liveNavItems.filter((item) => !item.mobile);

	return (
		<nav
			aria-label={t('section.account')}
			className='fixed inset-x-0 bottom-0 z-20 flex border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden'
		>
			{primary.map((item) => (
				<Link
					key={item.url}
					to={item.url}
					activeOptions={{ exact: item.url === '/' }}
					className={cn(
						'flex flex-1 flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground',
						'data-[status=active]:text-primary',
					)}
					activeProps={{ 'data-status': 'active' }}
				>
					{item.icon && <item.icon className='size-5' />}
					<span>{t(item.titleKey)}</span>
				</Link>
			))}
			<Sheet>
				<SheetTrigger className='flex flex-1 flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground'>
					<MoreHorizontal className='size-5' />
					<span>{t('item.more')}</span>
				</SheetTrigger>
				<SheetContent side='bottom' className='pb-[env(safe-area-inset-bottom)]'>
					<SheetHeader>
						<SheetTitle>{t('item.more')}</SheetTitle>
					</SheetHeader>
					<div className='grid grid-cols-2 gap-2 p-4 pt-0'>
						{rest.map((item) => (
							<Link
								key={item.url}
								to={item.url}
								className='flex items-center gap-2 rounded-md border p-3 text-sm'
							>
								{item.icon && <item.icon className='size-4' />}
								<span>{t(item.titleKey)}</span>
							</Link>
						))}
					</div>
				</SheetContent>
			</Sheet>
		</nav>
	);
}
