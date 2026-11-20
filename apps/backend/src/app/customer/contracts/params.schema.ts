/** Shared uuid path-param schema for the customer module's `:id` params. */
import { z } from 'zod';

export const uuidParamSchema = z.object({ id: z.uuid() });
