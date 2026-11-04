import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';

import { Badge } from '@ims-erp/ui/components/badge';

/**
 * Shared placeholder page for modules whose routes are registered but not
 * yet implemented. Real implementations replace the thin route file's
 * contents; the route shell (and its breadcrumb vocabulary) stays stable.
 */
export function ComingSoonPage({
	title,
	description,
	icon: Icon,
}: {
	title: string;
	description?: string;
	icon?: LucideIcon;
}) {
	const { t } = useTranslation('nav');

	return (
		<div className='flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center'>
			{Icon && (
				<div className='flex size-12 items-center justify-center rounded-xl bg-muted'>
					<Icon className='size-6 text-muted-foreground' />
				</div>
			)}
			<div className='flex items-center gap-2'>
				<h1 className='text-xl font-semibold'>{title}</h1>
				<Badge variant='outline'>{t('item.comingSoon')}</Badge>
			</div>
			{description && (
				<p className='max-w-md text-sm text-muted-foreground'>{description}</p>
			)}
		</div>
	);
}
