import { useEffect, useMemo, useState } from 'react';

import {
	Combobox,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from '@ims-erp/ui/components/combobox';

/** One selectable option. */
export type TSearchableOption = { value: string; label: string };

/**
 * A single-select combobox that searches **server-side**.
 *
 * @remarks
 * Wraps the `@ims-erp/ui` compound `Combobox` in the plain controlled
 * `value`/`onChange`/`onSearch` shape the forms in this app use, so callers do
 * not have to thread Base UI's open/input state.
 *
 * The search term is debounced before reaching `onSearch`, because every
 * keystroke would otherwise be a request (the location hierarchy is searched
 * against the API at each of four levels).
 *
 * Selecting never mutates the caller's state directly — the parent owns
 * cascade invalidation, which is the part most likely to be got wrong.
 */
export function SearchableSelect({
	value,
	options,
	loading = false,
	disabled = false,
	placeholder,
	emptyLabel,
	onSearch,
	onChange,
}: {
	/** Currently selected option value, or `null` when nothing is selected. */
	value: string | null;
	/** Options for the current search term. */
	options: readonly TSearchableOption[];
	/** Shows a loading affordance while a page is in flight. */
	loading?: boolean;
	/** Disables the control (e.g. a cascade level with no parent selected). */
	disabled?: boolean;
	/** Placeholder shown when nothing is selected. */
	placeholder: string;
	/** Shown when the current search returned nothing. */
	emptyLabel: string;
	/** Called with the debounced search term. */
	onSearch: (term: string) => void;
	/** Called with the selected value, or `null` on clear. */
	onChange: (value: string | null) => void;
}) {
	const [term, setTerm] = useState('');

	// Debounce so each level does not fire a request per keystroke.
	useEffect(() => {
		const handle = setTimeout(() => onSearch(term), 250);
		return () => clearTimeout(handle);
	}, [term, onSearch]);

	const selected = useMemo(
		() => options.find((option) => option.value === value) ?? null,
		[options, value],
	);

	return (
		<Combobox
			items={options as TSearchableOption[]}
			value={selected}
			onValueChange={(next) => onChange((next as TSearchableOption | null)?.value ?? null)}
			isItemEqualToValue={(item: TSearchableOption, candidate: TSearchableOption) =>
				item.value === candidate.value
			}
			disabled={disabled}
		>
			<ComboboxInput
				placeholder={placeholder}
				disabled={disabled}
				showClear
				onChange={(event) => setTerm(event.target.value)}
			/>
			<ComboboxList>
				{loading && options.length === 0 ? (
					<div className='px-2 py-1.5 text-sm text-muted-foreground'>…</div>
				) : null}
				<ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
				{options.map((option) => (
					<ComboboxItem key={option.value} value={option}>
						{option.label}
					</ComboboxItem>
				))}
			</ComboboxList>
		</Combobox>
	);
}
