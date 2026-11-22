import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Layers, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Field, FieldDescription, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@ims-erp/ui/components/empty';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { SearchableSelect } from '@/components/inventory/searchable-select';
import { listProducts, type TProductComponent, type TProductKind } from '@/lib/inventory-api';
import { itemDetailLink } from '@/lib/item-routes';

/** Server cap on the lines of one composition. */
export const MAX_COMPOSITION_LINES = 50;

/** A line being edited in a form; `quantity` stays text until it is saved. */
export type TCompositionDraft = {
	componentId: string;
	code: string;
	name: string;
	productKind: TProductKind;
	unitLabel: string;
	quantity: string;
};

/** Starts an editor from the lines the server returned (archived ones are kept so the user can see and drop them). */
export function toCompositionDrafts(components: readonly TProductComponent[] | undefined): TCompositionDraft[] {
	return (components ?? []).map((line) => ({
		componentId: line.componentId,
		code: line.code,
		name: line.name,
		productKind: line.productKind,
		unitLabel: line.unitLabel,
		quantity: String(Number(line.quantity)),
	}));
}

/** Parses a typed quantity: positive, at most three decimals; otherwise `null`. */
export function parseQuantity(text: string): number | null {
	const value = Number(text.replace(',', '.'));
	if (!Number.isFinite(value) || value <= 0) return null;
	return Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6 ? value : null;
}

/** The request lines, or `null` when any quantity is invalid. */
export function toCompositionLines(drafts: readonly TCompositionDraft[]) {
	const lines = drafts.map((draft) => ({ componentId: draft.componentId, quantity: parseQuantity(draft.quantity) }));
	return lines.every((line) => line.quantity !== null)
		? (lines as { componentId: string; quantity: number }[])
		: null;
}

/** Read-only composition of a product on its detail page. */
export function ProductCompositionPanel({
	components,
}: {
	components: readonly TProductComponent[];
}) {
	const { t } = useTranslation(['product']);
	return (
		<div className='flex flex-col gap-3'>
			{components.length === 0 ? (
				<Empty className='border'>
					<EmptyHeader>
						<EmptyMedia variant='icon'>
							<Layers />
						</EmptyMedia>
						<EmptyTitle>{t('product:composition.empty')}</EmptyTitle>
						<EmptyDescription>{t('product:composition.emptyHint')}</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t('product:composition.code')}</TableHead>
							<TableHead>{t('product:composition.name')}</TableHead>
							<TableHead>{t('product:items.kind')}</TableHead>
							<TableHead className='text-right'>{t('product:composition.quantity')}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{components.map((line) => (
							<TableRow key={line.id}>
								<TableCell className='font-mono text-xs'>{line.code}</TableCell>
								<TableCell>
									<Link {...itemDetailLink(line.productKind, line.componentId)} className='hover:underline'>
										{line.name}
									</Link>
									{line.isArchived && (
										<Badge variant='outline' className='ml-2'>
											{t('product:composition.archived')}
										</Badge>
									)}
								</TableCell>
								<TableCell>{t(`product:kind.${line.productKind}`)}</TableCell>
								<TableCell className='text-right'>
									{Number(line.quantity)} {line.unitLabel}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</div>
	);
}

/**
 * Editor of a product's composition inside the create/edit form.
 *
 * @remarks
 * Controlled: the form owns the drafts and saves them with
 * `saveProductComponents` once the product exists. Candidates are searched
 * on the server (components and materials together); rows already added are
 * left out of the options.
 */
export function ProductCompositionEditor({
	value,
	onChange,
	disabled = false,
}: {
	value: TCompositionDraft[];
	onChange: (next: TCompositionDraft[]) => void;
	disabled?: boolean;
}) {
	const { t } = useTranslation(['product']);
	const [term, setTerm] = useState('');
	const onSearch = useCallback((next: string) => setTerm(next), []);

	const candidates = useQuery({
		queryKey: ['composition-candidates', term] as const,
		queryFn: async () => {
			const [components, materials] = await Promise.all(
				(['component', 'material'] as const).map((productKind) =>
					listProducts({ productKind, search: term || undefined, activeOnly: true, limit: 10 }),
				),
			);
			return [...(components?.rows ?? []), ...(materials?.rows ?? [])];
		},
	});

	const taken = new Set(value.map((line) => line.componentId));
	const options = (candidates.data ?? [])
		.filter((item) => !taken.has(item.id))
		.map((item) => ({ value: item.id, label: `${item.code} - ${item.name}` }));

	function add(componentId: string | null) {
		const item = candidates.data?.find((row) => row.id === componentId);
		if (!item || value.length >= MAX_COMPOSITION_LINES) return;
		onChange([
			...value,
			{
				componentId: item.id,
				code: item.code,
				name: item.name,
				productKind: item.productKind,
				unitLabel: item.unitLabel,
				quantity: '1',
			},
		]);
	}

	return (
		<Field>
			<FieldLabel>{t('product:composition.title')}</FieldLabel>
			<div className='flex flex-col gap-2'>
				{value.map((line, index) => (
					<div key={line.componentId} className='flex items-center gap-2'>
						<div className='min-w-0 flex-1 truncate text-sm'>
							<span className='font-mono text-xs text-muted-foreground'>{line.code}</span> {line.name}
							<span className='ml-2 text-xs text-muted-foreground'>{t(`product:kind.${line.productKind}`)}</span>
						</div>
						<Input
							inputMode='decimal'
							className='w-24'
							aria-label={t('product:composition.quantity')}
							aria-invalid={parseQuantity(line.quantity) === null}
							value={line.quantity}
							disabled={disabled}
							onChange={(event) =>
								onChange(value.map((row, i) => (i === index ? { ...row, quantity: event.target.value } : row)))
							}
						/>
						<span className='w-10 text-xs text-muted-foreground'>{line.unitLabel}</span>
						<Button
							type='button'
							size='icon'
							variant='ghost'
							className='size-7'
							aria-label={t('product:composition.remove')}
							disabled={disabled}
							onClick={() => onChange(value.filter((_, i) => i !== index))}
						>
							<X className='size-4' />
						</Button>
					</div>
				))}
				{value.length < MAX_COMPOSITION_LINES && (
					<SearchableSelect
						value={null}
						options={options}
						loading={candidates.isFetching}
						disabled={disabled}
						placeholder={t('product:composition.add')}
						emptyLabel={t('product:composition.noMatch')}
						onSearch={onSearch}
						onChange={add}
					/>
				)}
			</div>
			<FieldDescription>{t('product:composition.hint', { max: MAX_COMPOSITION_LINES })}</FieldDescription>
		</Field>
	);
}
