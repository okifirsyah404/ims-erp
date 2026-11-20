import { z } from 'zod';

/** `:id` path parameter shared by every procurement controller. */
export const idParamSchema = z.object({ id: z.uuid() });
