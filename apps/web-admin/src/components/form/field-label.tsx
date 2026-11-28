import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { FieldLabel as BaseFieldLabel } from '@ims-erp/ui/components/field';

/**
 * Form field label that marks a required field with a red `*` (P7-6, RF-6)
 * or an optional one with a translated "(Optional)" suffix (ERP-0114).
 *
 * @remarks
 * Drop-in replacement for the UI package's `FieldLabel`, which carries no
 * i18n. Forms that mark required fields also show {@link RequiredLegend}
 * above the fields.
 */
export function FieldLabel({
	optional = false,
	required = false,
	children,
	...props
}: ComponentProps<typeof BaseFieldLabel> & {
	/** Appends the "(Optional)" suffix. */
	optional?: boolean;
	/** Appends a red `*`; screen readers hear "required". */
	required?: boolean;
}) {
	const { t } = useTranslation('common');
	return (
		<BaseFieldLabel {...props}>
			{children}
			{required && (
				<span className='text-destructive' aria-label={t('form.requiredMark')} title={t('form.requiredMark')}>
					*
				</span>
			)}
			{optional && <span className='font-normal text-muted-foreground'>({t('form.optional')})</span>}
		</BaseFieldLabel>
	);
}

/** The "* required" line shown at the top of a form with required fields (RF-6). */
export function RequiredLegend() {
	const { t } = useTranslation('common');
	return (
		<p className='text-sm text-muted-foreground'>
			<span className='text-destructive'>*</span> {t('form.requiredLegend')}
		</p>
	);
}
