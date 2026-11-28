import { CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { focusControl } from '@/lib/form-validation';

/** One clickable line of the summary. */
export type TSummaryItem = {
	/** `id` of the control to focus. */
	id: string;
	/** The worded error ("Nama wajib diisi."). */
	text: string;
};

/**
 * Error summary at the top of a form (P7-6, TF-3, RF-16, RF-17, RF-27).
 *
 * @remarks
 * Lists the field errors when there is more than one ("Ada 2 isian yang
 * perlu diperbaiki"), each line a button that focuses its control. A
 * `formMessage` (a server error that names no field, a server fault with its
 * reference, a lost connection) is always shown here, not only in a toast
 * that disappears.
 */
export function FormErrorSummary({
	items,
	formMessage,
}: {
	items: TSummaryItem[];
	formMessage?: string | null;
}) {
	const { t } = useTranslation('common');
	const showList = items.length > 1;
	if (!showList && !formMessage) return null;
	return (
		<div
			role='alert'
			data-slot='form-error-summary'
			className='flex gap-3 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive'
		>
			<CircleAlert className='mt-0.5 size-4 shrink-0' aria-hidden />
			<div className='flex flex-col gap-1'>
				{formMessage && <p>{formMessage}</p>}
				{showList && (
					<>
						<p className='font-medium'>{t('form.errorSummary', { count: items.length })}</p>
						<ul className='ml-4 list-disc'>
							{items.map((item) => (
								<li key={item.id}>
									<button type='button' className='text-left underline-offset-2 hover:underline' onClick={() => focusControl(item.id)}>
										{item.text}
									</button>
								</li>
							))}
						</ul>
					</>
				)}
			</div>
		</div>
	);
}
