import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { FieldLabel as BaseFieldLabel } from '@ims-erp/ui/components/field';

/**
 * Form field label that marks an optional field with a translated
 * "(Optional)" / "(Opsional)" suffix (ERP-0114).
 *
 * @remarks
 * Drop-in replacement for the UI package's `FieldLabel`, which carries no
 * i18n. Use `optional` on every field the form may submit empty; required
 * fields stay unmarked.
 */
export function FieldLabel({
	optional = false,
	children,
	...props
}: ComponentProps<typeof BaseFieldLabel> & {
	/** Appends the "(Optional)" suffix. */
	optional?: boolean;
}) {
	const { t } = useTranslation('common');
	return (
		<BaseFieldLabel {...props}>
			{children}
			{optional && <span className='font-normal text-muted-foreground'>({t('form.optional')})</span>}
		</BaseFieldLabel>
	);
}
