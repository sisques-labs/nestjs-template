import { z } from 'zod';

/** Input schema for the `subscription_find_by_id` MCP tool. */
export const subscriptionFindByIdSchema = {
  id: z.string().uuid().describe('UUID of the subscription'),
};
