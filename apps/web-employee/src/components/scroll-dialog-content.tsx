import type { ComponentProps } from 'react';

import { DialogContent } from '@ims-erp/ui/components/dialog';
import { ScrollArea } from '@ims-erp/ui/components/scroll-area';
import { cn } from '@ims-erp/ui/lib/utils';

/**
 * `DialogContent` for tall forms: the body scrolls inside a `ScrollArea`
 * instead of the browser's native scrollbar.
 *
 * @remarks
 * The popup itself is clipped (`overflow-hidden`, no padding) and the padding
 * moves to the inner wrapper, so a sticky `DialogFooter` (`-mx-4`, bottom-0)
 * still sits flush with the dialog edge while the content scrolls beneath it.
 */
export function ScrollDialogContent({
	className,
	children,
	...props
}: ComponentProps<typeof DialogContent>) {
	return (
		<DialogContent className={cn('max-h-[90vh] gap-0 overflow-hidden p-0', className)} {...props}>
			<ScrollArea className='[&_[data-slot=scroll-area-viewport]]:max-h-[90vh]'>
				<div className='grid gap-4 p-4 pb-0'>{children}</div>
			</ScrollArea>
		</DialogContent>
	);
}
