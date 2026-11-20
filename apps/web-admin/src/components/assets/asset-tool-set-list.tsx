import {
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Input } from '@ims-erp/ui/components/input';
import { CircleAlert, Package, Plus } from 'lucide-react';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	addToolSetItem,
	createToolSet,
	toolSetsQueryOptions,
	type TToolSet,
} from '@/lib/asset-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/assets/tool-sets` (validated search params). */
const routeApi = getRouteApi('/_authed/assets/tool-sets/');

const PAGE_SIZE = 12;

/**
 * Tool sets page (Phase A-4 / D11): kit list with create dialog and
 * add/remove item actions.
 */
export function AssetToolSetList() {
	const { t } = useTranslation(['assets', 'common']);
	const navigate = routeApi.useNavigate();
	const search = routeApi.useSearch();
	const [createOpen, setCreateOpen] = useState(false);
	const [addItemTarget, setAddItemTarget] = useState<TToolSet | null>(null);
	const [removeTarget, setRemoveTarget] = useState<TToolSet | null>(null);
	const canCreate = usePermission('asset.create');
	const canUpdate = usePermission('asset.update');

	const page = search.page ?? 1;
	const { data, isPending, isError, error } = useQuery({
		...toolSetsQueryOptions({ page, limit: PAGE_SIZE }),
		placeholderData: (previous) => previous,
	});

	if (isError) {
		return (
			<EmptyState
				icon={CircleAlert}
				title={t('assets:toolSets.emptyTitle')}
				description={error.message}
			/>
		);
	}

	return (
		<div className='space-y-4'>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<div>
					<h1 className='text-xl font-semibold'>{t('assets:toolSets.title')}</h1>
					<p className='text-sm text-muted-foreground'>
						{t('assets:toolSets.description')}
					</p>
				</div>
				{canCreate ? (
					<Button onClick={() => setCreateOpen(true)}>
						<Plus className='size-4' data-icon='inline-start' />
						{t('assets:toolSets.new')}
					</Button>
				) : null}
			</div>

			{isPending ? null : !data || data.rows.length === 0 ? (
				<EmptyState
					icon={Package}
					title={t('assets:toolSets.emptyTitle')}
					description={t('assets:toolSets.empty')}
				/>
			) : (
				<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
					{data.rows.map((toolSet) => (
						<Card key={toolSet.id}>
							<CardHeader>
								<CardTitle>{toolSet.name}</CardTitle>
								<p className='font-mono text-xs text-muted-foreground'>
									{toolSet.code}
								</p>
							</CardHeader>
							<CardContent className='text-sm'>
								{t(`assets:toolSetStatus.${toolSet.status}`)}
							</CardContent>
							<CardFooter className='justify-end gap-2'>
								{canUpdate ? (
									<>
										<Button
											size='sm'
											variant='outline'
											onClick={() => setAddItemTarget(toolSet)}
										>
											{t('assets:toolSets.addItem')}
										</Button>
										<Button
											size='sm'
											variant='ghost'
											onClick={() => setRemoveTarget(toolSet)}
										>
											{t('assets:toolSets.removeItem')}
										</Button>
									</>
								) : null}
							</CardFooter>
						</Card>
					))}
				</div>
			)}

			<PaginationControls
				page={page}
				totalPages={data?.pagination.totalPages ?? 1}
				onPageChange={(next) =>
					void navigate({ search: (prev) => ({ ...prev, page: next }) })
				}
			/>

			{createOpen ? <CreateToolSetDialog onClose={() => setCreateOpen(false)} /> : null}
			{addItemTarget ? (
				<AddToolSetItemDialog toolSet={addItemTarget} onClose={() => setAddItemTarget(null)} />
			) : null}
			{removeTarget ? (
				<RemoveToolSetItemDialog toolSet={removeTarget} onClose={() => setRemoveTarget(null)} />
			) : null}
		</div>
	);
}

/** Creates a tool set (TST-KIT code minted server-side). */
function CreateToolSetDialog({ onClose }: { onClose: () => void }) {
	const { t } = useTranslation('assets');
	const queryClient = useQueryClient();
	const [name, setName] = useState('');

	const create = useMutation({
		mutationFn: () => createToolSet({ name }),
		onSuccess: async () => {
			toast.success(t('toolSets.created'));
			setName('');
			onClose();
			await queryClient.invalidateQueries({ queryKey: ['asset-tool-sets'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t('toolSets.new')}</DialogTitle>
				</DialogHeader>
				<Input
					placeholder={t('toolSets.name')}
					value={name}
					onChange={(event) => setName(event.target.value)}
				/>
				<DialogFooter>
					<Button variant='outline' onClick={onClose}>
						{t('form.cancel')}
					</Button>
					<Button
						disabled={!name || create.isPending}
						onClick={() => void create.mutateAsync()}
					>
						{t('toolSets.new')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Adds an asset (by id) to a tool set. */
function AddToolSetItemDialog({
	toolSet,
	onClose,
}: {
	toolSet: TToolSet;
	onClose: () => void;
}) {
	const { t } = useTranslation('assets');
	const queryClient = useQueryClient();
	const [assetId, setAssetId] = useState('');

	const add = useMutation({
		mutationFn: () => addToolSetItem(toolSet.id, assetId),
		onSuccess: async () => {
			toast.success(t('toolSets.itemAdded'));
			setAssetId('');
			onClose();
			await queryClient.invalidateQueries({ queryKey: ['asset-tool-sets'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t('toolSets.addItem')}</DialogTitle>
					<DialogDescription>{toolSet.name}</DialogDescription>
				</DialogHeader>
				<Input
					placeholder={t('toolSets.assetId')}
					value={assetId}
					onChange={(event) => setAssetId(event.target.value)}
				/>
				<DialogFooter>
					<Button variant='outline' onClick={onClose}>
						{t('form.cancel')}
					</Button>
					<Button
						disabled={!assetId || add.isPending}
						onClick={() => void add.mutateAsync()}
					>
						{t('toolSets.addItem')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Removes an item (by item id) from a tool set. */
function RemoveToolSetItemDialog({
	toolSet,
	onClose,
}: {
	toolSet: TToolSet;
	onClose: () => void;
}) {
	const { t } = useTranslation('assets');
	const queryClient = useQueryClient();
	const [itemId, setItemId] = useState('');

	const remove = useMutation({
		mutationFn: async () => {
			const { removeToolSetItem } = await import('@/lib/asset-api');
			return removeToolSetItem(toolSet.id, itemId);
		},
		onSuccess: async () => {
			toast.success(t('toolSets.itemRemoved'));
			setItemId('');
			onClose();
			await queryClient.invalidateQueries({ queryKey: ['asset-tool-sets'] });
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t('toolSets.removeItem')}</DialogTitle>
				</DialogHeader>
				<Input
					placeholder='item id'
					value={itemId}
					onChange={(event) => setItemId(event.target.value)}
				/>
				<DialogFooter>
					<Button variant='outline' onClick={onClose}>
						{t('form.cancel')}
					</Button>
					<Button
						disabled={!itemId || remove.isPending}
						onClick={() => void remove.mutateAsync()}
					>
						{t('toolSets.removeItem')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
