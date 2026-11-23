import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	getCountries,
	getCountryCallingCode,
	parsePhoneNumberFromString,
	type CountryCode,
} from 'libphonenumber-js/min';
import { toE164 } from '@/lib/phone';

import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from '@ims-erp/ui/components/combobox';
import { Input } from '@ims-erp/ui/components/input';

/** Country default for this deployment (Indonesian business). */
const DEFAULT_COUNTRY: CountryCode = 'ID';

type TCountryOption = { value: CountryCode; label: string; callingCode: string };

/**
 * Splits a stored number into country + national part. E.164 parses
 * exactly; an older local value (`0812…`) is read with the default country;
 * anything unparseable is kept as typed under the default country.
 */
function splitPhone(value: string | null | undefined): { country: CountryCode; national: string } {
	if (!value) return { country: DEFAULT_COUNTRY, national: '' };
	const parsed = parsePhoneNumberFromString(value, DEFAULT_COUNTRY);
	if (parsed?.country) return { country: parsed.country, national: parsed.nationalNumber };
	return { country: DEFAULT_COUNTRY, national: value };
}

/**
 * Country-code + phone-number input that emits an E.164 value.
 *
 * @remarks
 * The backend stores and validates E.164 (`+6281234567890`), so the field
 * owns the assembly: the caller receives `''` while the field is empty or
 * incomplete and the canonical E.164 string once it is valid. Validation uses
 * `libphonenumber-js/min` — the same library and metadata the backend
 * re-parses with, so a number accepted here is not rejected there.
 *
 * A typed but invalid number marks the input invalid (`setCustomValidity`),
 * so the surrounding form cannot submit it silently as "empty" — also when
 * the field is optional (ERP-0114). `defaultValue` pre-fills an edit form.
 *
 * The country list is derived from the library's metadata (not a hardcoded
 * array) and labelled with `Intl.DisplayNames`, so it follows the active UI
 * language. Searching matches the country name and the dial code.
 */
export function CountryPhoneField({
	id,
	onChange,
	defaultValue = null,
	required = true,
	disabled = false,
}: {
	/** Id applied to the number input; the label's `htmlFor` targets it. */
	id: string;
	/** Emitted E.164 value, or `''` while empty or incomplete. */
	onChange: (e164: string) => void;
	/** Stored number (E.164 or an older local format) to start from. */
	defaultValue?: string | null;
	/** Whether the number must be filled in (default `true`). */
	required?: boolean;
	disabled?: boolean;
}) {
	const { t, i18n } = useTranslation(['claim']);
	const initial = useMemo(() => splitPhone(defaultValue), [defaultValue]);
	const [country, setCountry] = useState<TCountryOption>(() =>
		countryOption(initial.country, i18n.language),
	);
	const [national, setNational] = useState(initial.national);
	const [query, setQuery] = useState('');
	const numberInput = useRef<HTMLInputElement>(null);

	const countries = useMemo(
		() =>
			getCountries()
				.map((code) => countryOption(code, i18n.language))
				.sort((a, b) => a.label.localeCompare(b.label, i18n.language)),
		[i18n.language],
	);

	// Filtered here rather than via a `ComboboxList` function child: that
	// child must be the list's ONLY child, and the empty state lives inside
	// the list too.
	const matches = useMemo(() => {
		const term = query.trim().toLowerCase();
		if (!term) return countries;
		return countries.filter((option) =>
			option.label.toLowerCase().includes(term),
		);
	}, [countries, query]);

	const invalid = national.trim() !== '' && toE164(country.callingCode, national) === '';

	function emit(nextCountry: TCountryOption, nextNational: string) {
		const e164 = toE164(nextCountry.callingCode, nextNational);
		numberInput.current?.setCustomValidity(
			nextNational.trim() !== '' && e164 === '' ? t('form.phoneInvalid') : '',
		);
		onChange(e164);
	}

	return (
		<div className='flex gap-2'>
			<Combobox
				items={countries}
				value={country}
				onValueChange={(next) => {
					if (!next) return;
					setCountry(next);
					emit(next, national);
				}}
				isItemEqualToValue={(item: TCountryOption, candidate: TCountryOption) =>
					item.value === candidate.value
				}
				itemToStringLabel={(item: TCountryOption) => item.label}
				onInputValueChange={(value: string) => setQuery(value)}
				disabled={disabled}
			>
				<ComboboxInput
					className='w-40'
					aria-label={t('form.phoneCountry')}
					disabled={disabled}
					placeholder={t('form.phoneCountryPlaceholder')}
				/>
				<ComboboxContent>
					<ComboboxList>
						<ComboboxEmpty>{t('form.phoneCountryEmpty')}</ComboboxEmpty>
						{matches.map((option) => (
							<ComboboxItem key={option.value} value={option}>
								{option.label}
							</ComboboxItem>
						))}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
			<Input
				ref={numberInput}
				id={id}
				type='tel'
				inputMode='tel'
				autoComplete='tel-national'
				className='flex-1'
				value={national}
				disabled={disabled}
				required={required}
				aria-invalid={invalid || undefined}
				placeholder={t('form.phonePlaceholder')}
				onChange={(event) => {
					setNational(event.target.value);
					emit(country, event.target.value);
				}}
			/>
		</div>
	);
}

/** Builds a display option for one country, named in the active language. */
function countryOption(code: CountryCode, language: string): TCountryOption {
	const name = regionName(code, language);
	const callingCode = getCountryCallingCode(code);
	return {
		value: code,
		callingCode,
		label: `${name} (+${callingCode})`,
	};
}

/** Region display name, falling back to the raw code on old runtimes. */
function regionName(code: CountryCode, language: string): string {
	try {
		return (
			new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? code
		);
	} catch {
		return code;
	}
}
