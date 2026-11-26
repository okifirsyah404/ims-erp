import type { LucideIcon } from 'lucide-react';
import { EllipsisVertical } from 'lucide-react';

import { Button } from '@ims-erp/ui/components/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@ims-erp/ui/components/dropdown-menu';

/** One row action: icon button when the row has three or fewer, menu item beyond that. */
export type TRowAction = {
	key: string;
	label: string;
	icon: LucideIcon;
	onSelect: () => void;
	disabled?: boolean;
	destructive?: boolean;
	hidden?: boolean;
};

/**
 * Standard table row actions.
 *
 * @remarks
 * Three or fewer visible actions render as icon buttons; more collapse into an
 * ellipsis dropdown so the actions column keeps one width. `onSelect` owns any
 * confirmation dialog, matching the users table. `menu` forces the dropdown
 * even for one or two actions (card corners, where an icon strip is noisy).
 */
export function RowActions({
	actions,
	label,
	disabled,
	menu = false,
}: {
	actions: TRowAction[];
	label: string;
	disabled?: boolean;
	menu?: boolean;
}) {
	const visible = actions.filter((action) => !action.hidden);

	if (visible.length === 0) {
		return <span className='text-xs text-muted-foreground'>—</span>;
	}

	if (visible.length <= 3 && !menu) {
		return (
			<div className='flex justify-end gap-1'>
				{visible.map((action) => (
					<Button
						key={action.key}
						variant='ghost'
						size='icon'
						className={action.destructive ? 'text-destructive' : undefined}
						disabled={disabled || action.disabled}
						aria-label={action.label}
						title={action.label}
						onClick={action.onSelect}
					>
						<action.icon className='size-4' />
					</Button>
				))}
			</div>
		);
	}

	const firstDestructive = visible.findIndex((action) => action.destructive);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant='ghost'
						size='icon'
						disabled={disabled}
						aria-label={label}
					/>
				}
			>
				<EllipsisVertical className='size-4' />
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end' className='w-44'>
				{visible.map((action, index) => (
					<div key={action.key}>
						{index === firstDestructive && index > 0 && <DropdownMenuSeparator />}
						<DropdownMenuItem
							variant={action.destructive ? 'destructive' : 'default'}
							disabled={disabled || action.disabled}
							onClick={action.onSelect}
						>
							<action.icon />
							{action.label}
						</DropdownMenuItem>
					</div>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
