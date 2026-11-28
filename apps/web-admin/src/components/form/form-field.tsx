import type { ReactNode } from 'react';

import { Field, FieldDescription, FieldError } from '@ims-erp/ui/components/field';

import { FieldLabel } from '@/components/form/field-label';

/**
 * Shared form field: label with `*`, the rule shown before typing, and the
 * error under the input (P7-6, TF-3, RF-6, RF-15, RF-31).
 *
 * @remarks
 * The input itself is the child, so any control works (text, select, money,
 * date picker). Give the control the same `id` and `aria-invalid={!!error}`;
 * the UI inputs draw the red border from `aria-invalid`. `onBlur` bubbles
 * from the control and marks the field as left (RF-14).
 */
export function FormField({
	id,
	label,
	required = false,
	optional = false,
	description,
	error,
	onBlur,
	className,
	children,
}: {
	id: string;
	label: ReactNode;
	required?: boolean;
	optional?: boolean;
	/** The field's rule, format or example, shown before it is filled (RF-31). */
	description?: ReactNode;
	/** The worded error, from `useIssueText`. */
	error?: string | null;
	onBlur?: () => void;
	className?: string;
	children: ReactNode;
}) {
	return (
		<Field data-invalid={error ? true : undefined} className={className} onBlur={onBlur}>
			<FieldLabel htmlFor={id} required={required} optional={optional}>
				{label}
			</FieldLabel>
			{children}
			{description && <FieldDescription>{description}</FieldDescription>}
			{error && <FieldError id={`${id}-error`}>{error}</FieldError>}
		</Field>
	);
}
