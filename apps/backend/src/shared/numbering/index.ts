/**
 * Shared code-numbering helpers (ADR-0024 Q6).
 *
 * @remarks
 * Not a module: no DI token, no schema. Pure formatting lives in `domain.ts`,
 * the `<schema>.code_numberings` table factory in `table.ts`, and the atomic
 * allocation repository base in `repository-base.ts`.
 */
export * from './domain';
export * from './table';
export * from './repository-base';
