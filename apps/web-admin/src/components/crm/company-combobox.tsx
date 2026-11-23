import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';

import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from '@ims-erp/ui/components/combobox';
import { companiesQueryOptions, type TCustomerRef } from '@/lib/customer-api';

/**
 * Searchable picker of active customer companies (ERP-0114). Searches on the
 * server (`search`), so it scales past one page of companies; the current
 * value stays selectable even when it is not in the latest result.
 */
export function CompanyCombobox({
	id,
	value,
	onChange,
	placeholder,
	emptyText,
	ariaLabel,
	disabled = false,
	clearable = false,
	className = 'w-full',
}: {
	id?: string;
	value: TCustomerRef | null;
	onChange: (company: TCustomerRef | null) => void;
	placeholder: string;
	emptyText: string;
	ariaLabel?: string;
	disabled?: boolean;
	/** Shows a clear button (filters). */
	clearable?: boolean;
	className?: string;
}) {
	const [query, setQuery] = useState('');
	const search = useDeferredValue(query.trim());
	const companies = useQuery(
		companiesQueryOptions({ page: 1, limit: 20, status: 'active', search: search || undefined }),
	);
	const items = useMemo(() => {
		const rows: TCustomerRef[] = (companies.data?.rows ?? []).map(({ id: rowId, code, name }) => ({
			id: rowId,
			code,
			name,
		}));
		return value && !rows.some((row) => row.id === value.id) ? [value, ...rows] : rows;
	}, [companies.data, value]);
	const label = (item: TCustomerRef) => `${item.code} - ${item.name}`;

	return (
		<Combobox
			items={items}
			value={value}
			onValueChange={(next: TCustomerRef | null) => onChange(next)}
			isItemEqualToValue={(item: TCustomerRef, candidate: TCustomerRef) => item.id === candidate.id}
			itemToStringLabel={label}
			onInputValueChange={(next: string) => setQuery(next)}
			filter={null}
			disabled={disabled}
		>
			<ComboboxInput
				id={id}
				className={className}
				placeholder={placeholder}
				aria-label={ariaLabel}
				disabled={disabled}
				showClear={clearable && value !== null}
			/>
			<ComboboxContent>
				<ComboboxList>
					<ComboboxEmpty>{emptyText}</ComboboxEmpty>
					{items.map((item) => (
						<ComboboxItem key={item.id} value={item}>
							{label(item)}
						</ComboboxItem>
					))}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}
