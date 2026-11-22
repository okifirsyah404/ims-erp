import { useLayoutEffect, useRef, type ComponentProps } from 'react';

import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from '@ims-erp/ui/components/input-group';
import { formatMoneyDisplay, sanitizeMoney } from '@/lib/money-input';

type MoneyInputProps = Omit<
	ComponentProps<'input'>,
	'value' | 'onChange' | 'type' | 'inputMode' | 'prefix'
> & {
	/** Canonical rupiah string (`"1500000.5"`), the shape `rupiahToMinor` reads. */
	value: string;
	onValueChange: (value: string) => void;
	/** Keep a leading minus (adjustments, corrections). */
	allowNegative?: boolean;
	/** Applied to the group wrapper (width, margins), not to the inner input. */
	className?: string;
};

/** Characters that carry meaning in the display text (not the grouping dots). */
const SIGNIFICANT = /[\d,-]/;

/**
 * Rupiah amount field: an `InputGroup` with an "Rp" prefix and a plain text
 * input (no number spinner).
 *
 * @remarks
 * The field shows `id-ID` grouping (`1.500.000,5`) while `value` stays the
 * canonical string, so forms keep using `rupiahToMinor`/`minorToRupiah`.
 * Reformatting on every keystroke moves the caret to the end, so the caret is
 * restored to the same place counted in significant characters.
 */
export function MoneyInput({
	value,
	onValueChange,
	allowNegative = false,
	className,
	...props
}: MoneyInputProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const caret = useRef<number | null>(null);
	const display = formatMoneyDisplay(value);

	useLayoutEffect(() => {
		const element = inputRef.current;
		const wanted = caret.current;
		caret.current = null;
		if (!element || wanted === null || document.activeElement !== element) return;
		let seen = 0;
		let position = 0;
		while (position < display.length && seen < wanted) {
			if (SIGNIFICANT.test(display[position]!)) seen += 1;
			position += 1;
		}
		element.setSelectionRange(position, position);
	}, [display]);

	return (
		<InputGroup className={className}>
			<InputGroupAddon>
				<InputGroupText>Rp</InputGroupText>
			</InputGroupAddon>
			<InputGroupInput
				{...props}
				ref={inputRef}
				type='text'
				inputMode='decimal'
				autoComplete='off'
				value={display}
				onChange={(event) => {
					const target = event.target;
					const before = target.value.slice(0, target.selectionStart ?? target.value.length);
					caret.current = [...before].filter((char) => SIGNIFICANT.test(char)).length;
					onValueChange(sanitizeMoney(target.value, allowNegative));
				}}
			/>
		</InputGroup>
	);
}
