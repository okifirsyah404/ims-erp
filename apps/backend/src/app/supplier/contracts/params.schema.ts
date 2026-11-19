import { z } from 'zod';

/** Shared uuid path-param schema for the module's `:id` params. */
export const uuidParamSchema = z.object({ id: z.string().uuid() });
