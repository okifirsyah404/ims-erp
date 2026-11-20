import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useRef,
	useState,
} from 'react';
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

/** Copy and style for one confirmation prompt. */
export type TConfirmOptions = {
	/** Question shown as the dialog title. */
	title: string;
	/** Optional explanation under the title. */
	description?: string;
	/** Confirm button label. Defaults to `common:action.confirm`. */
	confirmLabel?: string;
	/** Style the confirm button as destructive. */
	destructive?: boolean;
};

type TConfirmFn = (options: TConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<TConfirmFn | null>(null);

/**
 * Hosts the single shared confirmation dialog and exposes {@link useConfirm}.
 *
 * @remarks
 * Replaces `window.confirm` so every confirmation uses the `@ims-erp/ui`
 * AlertDialog. Mount once near the app root.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
	const { t } = useTranslation('common');
	const [options, setOptions] = useState<TConfirmOptions | null>(null);
	const resolver = useRef<((value: boolean) => void) | null>(null);

	const confirm = useCallback<TConfirmFn>((next) => {
		// A prompt that is replaced before it was answered counts as cancelled.
		resolver.current?.(false);
		setOptions(next);
		return new Promise<boolean>((resolve) => {
			resolver.current = resolve;
		});
	}, []);

	const settle = (value: boolean) => {
		resolver.current?.(value);
		resolver.current = null;
		setOptions(null);
	};

	return (
		<ConfirmContext.Provider value={confirm}>
			{children}
			<AlertDialog
				open={options !== null}
				onOpenChange={(open) => {
					if (!open) settle(false);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{options?.title}</AlertDialogTitle>
						{options?.description ? (
							<AlertDialogDescription>
								{options.description}
							</AlertDialogDescription>
						) : null}
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t('action.cancel')}</AlertDialogCancel>
						<AlertDialogAction
							variant={options?.destructive ? 'destructive' : 'default'}
							onClick={() => settle(true)}
						>
							{options?.confirmLabel ?? t('action.confirm')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</ConfirmContext.Provider>
	);
}

/**
 * Returns `confirm(options)`, resolving `true` when the user confirms.
 *
 * @example
 * ```ts
 * const confirm = useConfirm();
 * if (await confirm({ title: t('x.deleteConfirm'), destructive: true })) { ... }
 * ```
 */
export function useConfirm(): TConfirmFn {
	const confirm = useContext(ConfirmContext);
	if (!confirm) throw new Error('useConfirm requires <ConfirmProvider>');
	return confirm;
}
