import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { toast } from '@/components/toast';
import {
	createCustomer,
	removeCustomerPhoto,
	type TCustomer,
	type TCustomerCredentials,
	type TCustomerInput,
	updateCustomer,
	uploadCustomerPhoto,
} from '@/lib/customer-api';

/** What the form asks for the photo: keep, replace with a file, or remove. */
export type TPhotoChange = { file: File } | { remove: true } | null;

/** The credentials of the last create, for the one-time dialog. */
export type TCreatedAccount = { name: string; email: string; credentials: TCustomerCredentials };

/**
 * Create/update of a person with their photo (ERP-0114).
 *
 * @remarks
 * The photo is a second request after the person exists, because it lives on
 * the account the create makes; a failed upload keeps the saved person and
 * warns. A create returns the credentials once: they land in `created` for
 * {@link CustomerCredentialsDialog}.
 */
export function useCustomerSave() {
	const { t } = useTranslation(['crm', 'common']);
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState(false);
	const [created, setCreated] = useState<TCreatedAccount | null>(null);

	async function save(
		customer: TCustomer | null,
		input: TCustomerInput,
		photo: TPhotoChange,
	): Promise<{ id: string } | null> {
		setSubmitting(true);
		try {
			const saved = customer ? await updateCustomer(customer.id, input) : await createCustomer(input);
			if (photo) {
				try {
					if ('file' in photo) await uploadCustomerPhoto(saved.id, photo.file);
					else await removeCustomerPhoto(saved.id);
				} catch {
					toast.error(t('crm:customers.photoFailed'));
				}
			}
			await queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });
			toast.success(t('crm:customers.saved'));
			if (!customer && 'credentials' in saved) {
				setCreated({ name: saved.name, email: input.email, credentials: saved.credentials as TCustomerCredentials });
			}
			return { id: saved.id };
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
			return null;
		} finally {
			setSubmitting(false);
		}
	}

	return { save, submitting, created, clearCreated: () => setCreated(null) };
}
