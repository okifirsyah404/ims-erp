import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import {
	districtsQueryOptions,
	provincesQueryOptions,
	regenciesQueryOptions,
	villageChainQueryOptions,
	villagesQueryOptions,
} from '@/lib/location-api';
import { SearchableSelect } from './searchable-select';

/** The four selected ids, deepest last. */
export type TLocationSelection = {
	provinceId: string | null;
	regencyId: string | null;
	districtId: string | null;
	villageId: string | null;
};

/** An empty selection. */
export const EMPTY_LOCATION_SELECTION: TLocationSelection = {
	provinceId: null,
	regencyId: null,
	districtId: null,
	villageId: null,
};

/**
 * Province → regency → district → village picker.
 *
 * @remarks
 * **Only the village id is persisted** (`warehouse_addresses.village_id`); the
 * three ancestors are presentation state needed to narrow each search. The
 * backend exposes an exact parent-id filter at every level plus a partial
 * `name` search, so each level is a server-searched combobox rather than a
 * fully materialised list.
 *
 * Two cascade rules are enforced here, and they are the ones most often got
 * wrong:
 *
 * 1. **Selecting a parent clears every deeper level.** Otherwise a saved
 *    address could pair a village with a district it does not belong to.
 * 2. **A level stays disabled until its parent is selected**, so no level can
 *    ever search the entire country.
 *
 * When editing, {@link villageChainQueryOptions} rebuilds the ancestors from
 * the stored village id (three hops: village → district → regency → province).
 */
export function LocationCascade({
	value,
	initialVillageId,
	onChange,
	disabled = false,
}: {
	/** Current selection (deepest level drives what gets saved). */
	value: TLocationSelection;
	/**
	 * Village id already stored on the address, if any.
	 *
	 * @remarks
	 * Used only to hydrate the ancestors on first render; the parent owns the
	 * selection from then on.
	 */
	initialVillageId?: string | null;
	onChange: (next: TLocationSelection) => void;
	disabled?: boolean;
}) {
	const { t } = useTranslation(['inventory', 'warehouse']);
	const [terms, setTerms] = useState({
		province: '',
		regency: '',
		district: '',
		village: '',
	});

	// Rebuild the ancestor chain for an existing address.
	const chain = useQuery(
		villageChainQueryOptions(value.villageId ? null : initialVillageId),
	);

	const hydrated = useMemo<TLocationSelection>(() => {
		if (value.provinceId || !chain.data?.village) return value;
		return {
			provinceId: chain.data.province?.id ?? null,
			regencyId: chain.data.regency?.id ?? null,
			districtId: chain.data.district?.id ?? null,
			villageId: chain.data.village.id,
		};
	}, [value, chain.data]);

	const provinces = useQuery(
		provincesQueryOptions({ name: terms.province, limit: 25 }),
	);
	const regencies = useQuery(
		regenciesQueryOptions({
			provinceId: hydrated.provinceId,
			name: terms.regency,
			limit: 25,
		}),
	);
	const districts = useQuery(
		districtsQueryOptions({
			regencyId: hydrated.regencyId,
			name: terms.district,
			limit: 25,
		}),
	);
	const villages = useQuery(
		villagesQueryOptions({
			districtId: hydrated.districtId,
			name: terms.village,
			limit: 25,
		}),
	);

	const setTerm = useCallback(
		(level: keyof typeof terms) => (term: string) =>
			setTerms((previous) =>
				previous[level] === term ? previous : { ...previous, [level]: term },
			),
		[],
	);

	/** Selecting a level clears everything below it. */
	const select = useCallback(
		(level: keyof TLocationSelection, next: string | null) => {
			const order: Array<keyof TLocationSelection> = [
				'provinceId',
				'regencyId',
				'districtId',
				'villageId',
			];
			const index = order.indexOf(level);
			const cleared = { ...hydrated, [level]: next };
			for (const deeper of order.slice(index + 1)) cleared[deeper] = null;
			onChange(cleared);
		},
		[hydrated, onChange],
	);

	return (
		<FieldGroup className='grid gap-4 sm:grid-cols-2'>
			<Field>
				<FieldLabel>{t('warehouse:address.province')}</FieldLabel>
				<SearchableSelect
					value={hydrated.provinceId}
					options={toOptions(provinces.data?.rows)}
					loading={provinces.isFetching}
					disabled={disabled}
					placeholder={t('warehouse:address.searchProvince')}
					emptyLabel={t('warehouse:address.noResults')}
					onSearch={setTerm('province')}
					onChange={(next) => select('provinceId', next)}
				/>
			</Field>
			<Field>
				<FieldLabel>{t('warehouse:address.regency')}</FieldLabel>
				<SearchableSelect
					value={hydrated.regencyId}
					options={toOptions(regencies.data?.rows)}
					loading={regencies.isFetching}
					disabled={disabled || !hydrated.provinceId}
					placeholder={t('warehouse:address.searchRegency')}
					emptyLabel={t('warehouse:address.noResults')}
					onSearch={setTerm('regency')}
					onChange={(next) => select('regencyId', next)}
				/>
			</Field>
			<Field>
				<FieldLabel>{t('warehouse:address.district')}</FieldLabel>
				<SearchableSelect
					value={hydrated.districtId}
					options={toOptions(districts.data?.rows)}
					loading={districts.isFetching}
					disabled={disabled || !hydrated.regencyId}
					placeholder={t('warehouse:address.searchDistrict')}
					emptyLabel={t('warehouse:address.noResults')}
					onSearch={setTerm('district')}
					onChange={(next) => select('districtId', next)}
				/>
			</Field>
			<Field>
				<FieldLabel>{t('warehouse:address.village')}</FieldLabel>
				<SearchableSelect
					value={hydrated.villageId}
					options={toOptions(villages.data?.rows)}
					loading={villages.isFetching}
					disabled={disabled || !hydrated.districtId}
					placeholder={t('warehouse:address.searchVillage')}
					emptyLabel={t('warehouse:address.noResults')}
					onSearch={setTerm('village')}
					onChange={(next) => select('villageId', next)}
				/>
			</Field>
		</FieldGroup>
	);
}

/**
 * Maps location rows onto combobox options.
 *
 * @param rows - Rows from the API, possibly undefined while loading
 */
function toOptions(
	rows: ReadonlyArray<{ id: string; name: string }> | undefined,
) {
	return (rows ?? []).map((row) => ({ value: row.id, label: row.name }));
}
