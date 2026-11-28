// Preload for bun test: tsyringe needs a reflect polyfill under this runtime
// (see .agents/skills/tsyringe rule 2.1 and .agents/skills/bun-test).
import 'reflect-metadata';

// P7-5: services take the transaction runner so a document number is allocated
// in the same transaction as the document. Test containers built by hand never
// registered one, so resolving those services failed. This pass-through runner
// (no real transaction) is the default; a test that needs a specific runner
// registers its own, and tsyringe resolves the last registration.
import { container } from 'tsyringe';
import { TRANSACTION_RUNNER_TOKEN } from '../src/providers/database/transaction-runner';

container.register(TRANSACTION_RUNNER_TOKEN, {
	useValue: { run: (work) => work(undefined as never) },
});
