/**
 * Generic CRUD contract for a repository over a soft-deletable entity.
 *
 * @remarks
 * Implementations back onto Drizzle tables that use the `deleted_at`
 * soft-delete convention: `delete` marks rows deleted, `forceDelete`
 * removes them permanently. Read methods exclude soft-deleted rows
 * unless explicitly named otherwise.
 *
 * @typeParam T - The data shape used to create/update the entity
 * @typeParam R - The full entity shape returned by reads
 */
export interface IBaseRepository<T, R> {
	/**
	 * Persists a new entity.
	 *
	 * @param item - The entity data
	 * @returns The created entity
	 */
	create(item: T): Promise<R>;

	/**
	 * Persists multiple entities in one operation.
	 *
	 * @param items - The entity data list
	 * @returns The created entities
	 */
	createMany(items: T[]): Promise<R[]>;

	/**
	 * Fetches all non-deleted entities.
	 *
	 * @returns All entities, soft-deleted ones excluded
	 */
	findAll(): Promise<R[]>;

	/**
	 * Fetches all entities including soft-deleted ones.
	 *
	 * @returns Every entity, deleted or not
	 */
	findAllWithDeleted(): Promise<R[]>;

	/**
	 * Finds one entity by its identifier.
	 *
	 * @param id - The entity identifier
	 * @returns The entity, or `null` when absent or soft-deleted
	 */
	findById(id: string | number): Promise<R | null>;

	/**
	 * Finds multiple entities by their identifiers.
	 *
	 * @param ids - The entity identifiers
	 * @returns The matching entities; missing ones are omitted
	 */
	findByIds(ids: (string | number)[]): Promise<R[]>;

	/**
	 * Finds one soft-deleted entity by its identifier.
	 *
	 * @param id - The entity identifier
	 * @returns The deleted entity, or `null` when absent or not deleted
	 */
	findSoftDeletedById(id: string | number): Promise<R | null>;

	/**
	 * Updates one entity by its identifier.
	 *
	 * @param id - The entity identifier
	 * @param item - The updated entity data
	 * @returns The updated entity, or `null` when absent or soft-deleted
	 */
	update(id: string | number, item: T): Promise<R | null>;

	/**
	 * Soft-deletes one entity; recoverable via {@link restore}.
	 *
	 * @param id - The entity identifier
	 */
	delete(id: string | number): Promise<void>;

	/**
	 * Soft-deletes multiple entities; recoverable via {@link restore}.
	 *
	 * @param ids - The entity identifiers
	 */
	deleteMany(ids: (string | number)[]): Promise<void>;

	/**
	 * Permanently removes one entity; not recoverable.
	 *
	 * @param id - The entity identifier
	 */
	forceDelete(id: string | number): Promise<void>;

	/**
	 * Permanently removes multiple entities; not recoverable.
	 *
	 * @param ids - The entity identifiers
	 */
	forceDeleteMany(ids: (string | number)[]): Promise<void>;

	/**
	 * Restores a soft-deleted entity.
	 *
	 * @param id - The entity identifier
	 * @returns The restored entity, or `null` when absent or not deleted
	 */
	restore(id: string | number): Promise<R | null>;
}
