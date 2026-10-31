import { Link } from '@tanstack/react-router';
import { FileQuestion } from 'lucide-react';
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
	return (
		<Empty className='min-h-svh'>
			<EmptyHeader>
				<EmptyMedia variant='icon'>
					<FileQuestion />
				</EmptyMedia>
				<EmptyTitle className='text-2xl font-semibold'>
					404 — Page not found
				</EmptyTitle>
				<EmptyDescription>
					The page you&rsquo;re looking for doesn&rsquo;t exist or has been
					moved.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button render={<Link to='/'>Back to dashboard</Link>} />
			</EmptyContent>
		</Empty>
	);
}
