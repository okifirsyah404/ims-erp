// Preload for bun test: tsyringe needs a reflect polyfill under this runtime
// (see .agents/skills/tsyringe rule 2.1 and .agents/skills/bun-test).
import 'reflect-metadata';
