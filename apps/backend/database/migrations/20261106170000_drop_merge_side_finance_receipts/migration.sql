-- Merge reconciliation: the merged history contains two finance schema
-- definitions (merge side 20261106110700: finance.invoices + finance.receipts
-- vs main side 20261106221731: the accounting-era finance schema). The
-- merge-side objects are dropped here so main's definitions are the ones
-- that survive; rows are not preserved because the slice was never released.
DROP SCHEMA IF EXISTS "finance" CASCADE;
