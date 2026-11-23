import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import type { TCustomerCredentials } from '@/lib/customer-api';

/**
 * Shows the login details of a just-created customer account once
 * (ERP-0114). The same details were emailed to the customer; the password
 * is never retrievable again from the ERP.
 */
export function CustomerCredentialsDialog({
	name,
	email,
	credentials,
	onClose,
}: {
	name: string;
	email: string;
	credentials: TCustomerCredentials;
	onClose: () => void;
}) {
	const { t } = useTranslation(['crm']);
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className='sm:max-w-md'>
				<DialogHeader>
					<DialogTitle>{t('crm:credentials.title')}</DialogTitle>
					<DialogDescription>{t('crm:credentials.description', { name, email })}</DialogDescription>
				</DialogHeader>
				<dl className='grid gap-3 rounded-md border bg-muted/40 p-3'>
					<CredentialRow label={t('crm:credentials.username')} value={credentials.username} />
					<CredentialRow label={t('crm:credentials.password')} value={credentials.password} />
				</dl>
				<p className='text-xs text-muted-foreground'>{t('crm:credentials.once')}</p>
				<DialogFooter>
					<Button onClick={onClose}>{t('crm:credentials.done')}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function CredentialRow({ label, value }: { label: string; value: string }) {
	const { t } = useTranslation(['crm']);
	const [copied, setCopied] = useState(false);
	return (
		<div className='flex items-center justify-between gap-2'>
			<div className='min-w-0'>
				<dt className='text-xs text-muted-foreground'>{label}</dt>
				<dd className='truncate font-mono text-sm'>{value}</dd>
			</div>
			<Button
				type='button'
				variant='ghost'
				size='sm'
				aria-label={`${t('crm:credentials.copy')} ${label}`}
				onClick={() => {
					void navigator.clipboard?.writeText(value).then(() => {
						setCopied(true);
						window.setTimeout(() => setCopied(false), 1500);
					});
				}}
			>
				{copied ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
				<span className='sr-only sm:not-sr-only'>
					{copied ? t('crm:credentials.copied') : t('crm:credentials.copy')}
				</span>
			</Button>
		</div>
	);
}
