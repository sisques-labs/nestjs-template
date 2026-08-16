import { z } from 'zod';

/** Input schema for the `payment_find_by_criteria` MCP tool. */
export const paymentFindByCriteriaSchema = {
  page: z.number().int().positive().optional().describe('1-based page number'),
  perPage: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe('Number of items per page (max 100)'),
};
