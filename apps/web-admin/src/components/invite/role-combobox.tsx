import { useTranslation } from 'react-i18next';

import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
	useComboboxAnchor,
} from '@ims-erp/ui/components/combobox';
import { erpRoleLabel } from '@ims-erp/common';

/**
 * Searchable multi-role picker (P7-4): chips for the chosen roles, a search
 * box, and only the roles the caller may hand out.
 *
 * @remarks
 * `roles` is the offered set from the shared ladder
 * (`grantableOrganizationRoles` / `assignableOrganizationRoles`), so the base
 * `member` role and the removed roles never appear; the backend adds `member`
 * to every member itself. A selected role that is not in `roles` (the caller
 * switched to an organization where it is not allowed) is dropped from the
 * value shown, mirroring what will be sent.
 */
export function RoleCombobox({
	roles,
	value,
	onChange,
	placeholder,
	id,
	invalid = false,
}: {
	roles: readonly string[];
	value: readonly string[];
	onChange: (roles: string[]) => void;
	placeholder: string;
	id?: string;
	invalid?: boolean;
}) {
	const { t, i18n } = useTranslation(['admin']);
	const anchor = useComboboxAnchor();
	const selected = value.filter((role) => roles.includes(role));
	const label = (role: string) => erpRoleLabel(role, i18n.language);

	return (
		<Combobox<string, true>
			multiple
			items={[...roles]}
			value={selected}
			onValueChange={(next) => onChange(next)}
			itemToStringLabel={label}
		>
			<ComboboxChips ref={anchor} className='w-full'>
				<ComboboxValue>
					{(chosen: string[]) => (
						<>
							{chosen.map((role) => (
								<ComboboxChip key={role}>{label(role)}</ComboboxChip>
							))}
							<ComboboxChipsInput
								id={id}
								aria-invalid={invalid || undefined}
								placeholder={chosen.length === 0 ? placeholder : undefined}
							/>
						</>
					)}
				</ComboboxValue>
			</ComboboxChips>
			<ComboboxContent anchor={anchor}>
				<ComboboxEmpty>{t('invite.roleEmpty')}</ComboboxEmpty>
				<ComboboxList>
					{(role: string) => (
						<ComboboxItem key={role} value={role}>
							{label(role)}
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}
