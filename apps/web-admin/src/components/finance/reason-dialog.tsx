import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Dialog,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field } from '@ims-erp/ui/components/field';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { FieldLabel } from '@/components/form/field-label';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';

/**
 * Asks for a mandatory reason before a journal action (reject, reverse).
 * The server enforces the reason too; this only collects it.
 */
export function ReasonDialog({
	title,
	description,
	confirmLabel,
	submitting,
	onConfirm,
	onClose,
}: {
	title: string;
	description?: string;
	confirmLabel: string;
	submitting: boolean;
	onConfirm: (reason: string) => void;
	onClose: () => void;
}) {
	const { t } = useTranslation(['finance', 'common']);
	const [reason, setReason] = useState('');
	const trimmed = reason.trim();

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-lg'>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						if (trimmed) onConfirm(trimmed);
					}}
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						{description ? <DialogDescription>{description}</DialogDescription> : null}
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor='journal-reason'>{t('finance:journal.reason')}</FieldLabel>
						<Textarea
							id='journal-reason'
							value={reason}
							maxLength={500}
							onChange={(event) => setReason(event.target.value)}
						/>
						{trimmed ? null : (
							<p className='text-muted-foreground text-xs'>{t('finance:journal.reasonRequired')}</p>
						)}
					</Field>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' variant='destructive' disabled={!trimmed || submitting}>
							{confirmLabel}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
