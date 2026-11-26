import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { formatBusinessDate, formatDateTime } from '@/lib/format';
import {
	downloadMyDocumentFile,
	myDocumentsQueryOptions,
	type TMyDocument,
} from '@/lib/documents-api';
import { toast } from '@/components/toast';

/** `/documents` — documents issued to the caller or awaiting their signature. */
export function DocumentsPage() {
	const { t, i18n } = useTranslation('employee');
	const [search, setSearch] = useState('');
	const { data, isPending, isError, error } = useQuery(
		myDocumentsQueryOptions({ search: search.trim() || undefined }),
	);

	const download = async (document_: TMyDocument) => {
		try {
			if (!document_.fileId) throw new Error(t('documents.notReady'));
			const link = await downloadMyDocumentFile(document_.id, document_.fileId);
			window.open(link.url, '_blank', 'noopener');
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('documents.notReady'));
		}
	};

	return (
		<div className='flex flex-col gap-4 md:gap-6'>
			<header className='space-y-1'>
				<h1 className='text-xl font-semibold md:text-2xl'>{t('documents.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('documents.subtitle')}</p>
			</header>

			<Input
				value={search}
				onChange={(event) => setSearch(event.target.value)}
				placeholder={t('documents.search')}
				className='max-w-sm'
			/>

			{isPending ? (
				<PageSkeleton cards={2} />
			) : isError ? (
				<ErrorState error={error} />
			) : (data ?? []).length === 0 ? (
				<EmptyState title={t('documents.empty')} bordered />
			) : (
				<ul className='grid gap-2 md:grid-cols-2'>
					{(data ?? []).map((document_) => (
						<li key={document_.id}>
							<Card>
								<CardHeader className='flex-row items-start justify-between gap-2'>
									<div className='space-y-1'>
										<p className='text-xs text-muted-foreground'>{document_.code}</p>
										<CardTitle className='text-sm font-medium'>{document_.title}</CardTitle>
									</div>
									{document_.pendingSignatureRequestId ? (
										<Badge className='shrink-0'>{t('documents.needsSignature')}</Badge>
									) : null}
								</CardHeader>
								<CardContent className='space-y-2'>
									<p className='text-xs text-muted-foreground'>
										{document_.issuedOn
											? t('documents.issuedOn', { date: formatBusinessDate(document_.issuedOn, i18n.language) })
											: formatDateTime(document_.createdAt, i18n.language)}
									</p>
									<Button size='sm' variant='outline' onClick={() => void download(document_)}>
										{t('documents.download')}
									</Button>
								</CardContent>
							</Card>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export const Route = createFileRoute('/_authed/documents')({
	component: DocumentsPage,
});


