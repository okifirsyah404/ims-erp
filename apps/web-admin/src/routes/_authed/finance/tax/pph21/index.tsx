import { createFileRoute } from '@tanstack/react-router';

import { Pph21Tables } from '@/components/tax/pph21-tables';

/** `/finance/tax/pph21` - PTKP, TER and Pasal 17 tables (ERP-0138). */
export const Route = createFileRoute('/_authed/finance/tax/pph21/')({
	component: Pph21Tables,
});
