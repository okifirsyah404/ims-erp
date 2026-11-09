import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import type { TBastInput } from '@/lib/handover-api';
import { DocumentItemsEditor } from './document-items-editor';

type TParty = 'first' | 'second';

/**
 * BAST form (new and edit). The scope is one item per line; `**…**` prints
 * bold on the document.
 */
export function BastForm({
	initial,
	submitLabel,
	busy,
	onSubmit,
	onCancel,
}: {
	initial: TBastInput;
	submitLabel: string;
	busy: boolean;
	onSubmit: (input: TBastInput) => void;
	onCancel: () => void;
}) {
	const { t } = useTranslation(['projects', 'common']);
	const [value, setValue] = useState<TBastInput>(initial);
	const [scope, setScope] = useState(initial.scope.join('\n'));
	const set = (patch: Partial<TBastInput>) => setValue((current) => ({ ...current, ...patch }));
	const party = (side: TParty) => {
		const key = side === 'first' ? 'firstParty' : 'secondParty';
		const field = (name: 'Company' | 'Name' | 'Title') => `${key}${name}` as keyof TBastInput;
		return (
			<Card>
				<CardHeader>
					<CardTitle>{t(side === 'first' ? 'projects:bast.firstParty' : 'projects:bast.secondParty')}</CardTitle>
				</CardHeader>
				<CardContent>
					<FieldGroup className='grid gap-4 sm:grid-cols-3'>
						{(['Company', 'Name', 'Title'] as const).map((name) => (
							<Field key={name}>
								<FieldLabel htmlFor={`bast-${side}-${name}`}>{t(`projects:bast.party${name}`)}</FieldLabel>
								<Input
									id={`bast-${side}-${name}`}
									required
									maxLength={name === 'Company' ? 200 : 120}
									value={value[field(name)] as string}
									onChange={(event) => set({ [field(name)]: event.target.value } as Partial<TBastInput>)}
								/>
							</Field>
						))}
					</FieldGroup>
				</CardContent>
			</Card>
		);
	};

	return (
		<form
			className='flex flex-col gap-6'
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit({
					...value,
					contractNumber: value.contractNumber?.trim() || null,
					projectName: value.projectName?.trim() || null,
					scope: scope
						.split('\n')
						.map((line) => line.trim())
						.filter(Boolean),
				});
			}}
		>
			<Card>
				<CardContent className='pt-6'>
					<FieldGroup className='grid gap-4 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='bast-date'>{t('projects:bast.date')}</FieldLabel>
							<Input id='bast-date' type='date' required value={value.bastDate} onChange={(event) => set({ bastDate: event.target.value })} />
						</Field>
						<Field>
							<FieldLabel htmlFor='bast-contract'>{t('projects:bast.contractNumber')}</FieldLabel>
							<Input id='bast-contract' maxLength={120} value={value.contractNumber ?? ''} onChange={(event) => set({ contractNumber: event.target.value })} />
						</Field>
						<Field>
							<FieldLabel htmlFor='bast-work'>{t('projects:bast.workTitle')}</FieldLabel>
							<Input id='bast-work' required maxLength={300} value={value.workTitle} onChange={(event) => set({ workTitle: event.target.value })} />
						</Field>
						<Field>
							<FieldLabel htmlFor='bast-project-name'>{t('projects:bast.projectName')}</FieldLabel>
							<Input id='bast-project-name' maxLength={200} value={value.projectName ?? ''} onChange={(event) => set({ projectName: event.target.value })} />
						</Field>
					</FieldGroup>
				</CardContent>
			</Card>
			{party('first')}
			{party('second')}
			<Card>
				<CardHeader>
					<CardTitle>{t('projects:bast.items')}</CardTitle>
				</CardHeader>
				<CardContent>
					<DocumentItemsEditor idPrefix='bast-item' value={value.items} onChange={(items) => set({ items })} />
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>{t('projects:bast.scope')}</CardTitle>
				</CardHeader>
				<CardContent>
					<Field>
						<Textarea id='bast-scope' aria-label={t('projects:bast.scope')} rows={6} value={scope} onChange={(event) => setScope(event.target.value)} />
						<FieldDescription>{t('projects:bast.scopeHint')}</FieldDescription>
					</Field>
				</CardContent>
			</Card>
			<div className='flex justify-end gap-2'>
				<Button type='button' variant='outline' onClick={onCancel}>
					{t('common:action.cancel')}
				</Button>
				<Button type='submit' disabled={busy}>
					{submitLabel}
				</Button>
			</div>
		</form>
	);
}
