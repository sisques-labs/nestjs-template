import { z } from 'zod';

/** Input schema for the `payment_find_by_id` MCP tool. */
export const paymentFindByIdSchema = {
  id: z.string().uuid().describe('UUID of the payment'),
};
