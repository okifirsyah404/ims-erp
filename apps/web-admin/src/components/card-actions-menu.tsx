import { EllipsisVertical, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@ims-erp/ui/components/alert-dialog';
import { Button } from '@ims-erp/ui/components/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@ims-erp/ui/components/dropdown-menu';
import { Input } from '@ims-erp/ui/components/input';

/** One entry of a card's action menu. */
export type TCardAction = {
	key: string;
	label: string;
	icon: LucideIcon;
	/** Runs on select, or after the confirmation when `confirm` is set. */
	onSelect: (reason?: string) => unknown;
	/** Red entry, grouped after a separator. */
	destructive?: boolean;
	/** Ask first, in an alert dialog. */
	confirm?: {
		title: string;
		description: string;
		confirmLabel: string;
		/** Adds a required free-text reason (asset deactivation, D18). */
		reasonPlaceholder?: string;
	};
};

/**
 * The "..." menu in the top-right corner of an entity card.
 *
 * @remarks
 * Render it as a **sibling** of the card's `<Link>`, inside a `relative`
 * wrapper, never inside the link: the menu and its alert dialog live in
 * portals, and React bubbles their clicks through the component tree, which
 * would otherwise navigate to the detail page. Actions that must not run
 * silently (archive, delete) open an `AlertDialog` first.
 */
export function CardActionsMenu({
	actions,
	className,
}: {
	actions: TCardAction[];
	className?: string;
}) {
	const { t } = useTranslation('common');
	const [pending, setPending] = useState<TCardAction | null>(null);
	const [reason, setReason] = useState('');
	const [running, setRunning] = useState(false);

	if (actions.length === 0) return null;

	const firstDestructive = actions.findIndex((action) => action.destructive);

	async function run(action: TCardAction, value?: string) {
		setRunning(true);
		try {
			await action.onSelect(value);
		} finally {
			setRunning(false);
			setPending(null);
			setReason('');
		}
	}

	return (
		<div className={className ?? 'absolute top-2 right-2 z-10'}>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant='secondary'
							size='icon-sm'
							className='shadow-sm'
							aria-label={t('cardMenu.label')}
						/>
					}
				>
					<EllipsisVertical />
				</DropdownMenuTrigger>
				<DropdownMenuContent align='end' className='w-52'>
					{actions.map((action, index) => (
						<div key={action.key}>
							{index === firstDestructive && index > 0 ? <DropdownMenuSeparator /> : null}
							<DropdownMenuItem
								variant={action.destructive ? 'destructive' : 'default'}
								onClick={() => {
									if (action.confirm) {
										setReason('');
										setPending(action);
									} else {
										void run(action);
									}
								}}
							>
								<action.icon />
								{action.label}
							</DropdownMenuItem>
						</div>
					))}
				</DropdownMenuContent>
			</DropdownMenu>

			<AlertDialog open={pending !== null} onOpenChange={(open) => !open && !running && setPending(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{pending?.confirm?.title}</AlertDialogTitle>
						<AlertDialogDescription>{pending?.confirm?.description}</AlertDialogDescription>
					</AlertDialogHeader>
					{pending?.confirm?.reasonPlaceholder ? (
						<Input
							autoFocus
							placeholder={pending.confirm.reasonPlaceholder}
							value={reason}
							onChange={(event) => setReason(event.target.value)}
						/>
					) : null}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={running}>{t('action.cancel')}</AlertDialogCancel>
						<AlertDialogAction
							variant={pending?.destructive ? 'destructive' : 'default'}
							disabled={running || (Boolean(pending?.confirm?.reasonPlaceholder) && reason.trim() === '')}
							onClick={() => pending && void run(pending, reason.trim() || undefined)}
						>
							{pending?.confirm?.confirmLabel}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
