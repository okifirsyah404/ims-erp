import { Link } from '@tanstack/react-router';
import { FileQuestion } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@ims-erp/ui/components/button';
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@ims-erp/ui/components/empty';

/**
 * Full-viewport 404 page built from the shadcn Empty primitives. Rendered as
 * the router-wide `notFoundComponent` on the root route, so it covers every
 * unmatched URL — including those hit by logged-out visitors (route matching
 * happens before the `_authed` guard runs).
 */
export function NotFound() {
	const { t } = useTranslation('common');

	return (
		<Empty className='min-h-svh'>
			<EmptyHeader>
				<EmptyMedia variant='icon'>
					<FileQuestion />
				</EmptyMedia>
				<EmptyTitle className='text-2xl font-semibold'>
					{t('notFound.title')}
				</EmptyTitle>
				<EmptyDescription>{t('notFound.description')}</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button render={<Link to='/' />}>{t('notFound.backToDashboard')}</Button>
			</EmptyContent>
		</Empty>
	);
}
