import { Injectable, Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { IMcpTool, McpTool } from '@sisques-labs/nestjs-kit/mcp';
import { PaymentFindByIdQuery } from '@contexts/payments/application/queries/payment-find-by-id/payment-find-by-id.query';

import { paymentFindByIdSchema } from '../schemas/payment-find-by-id.schema';

/**
 * Read-only by design — see the context README for why the four money-
 * moving commands (CreatePayment, RefundPayment, CreateSubscription,
 * CancelSubscription) are deliberately NOT exposed as MCP tools.
 */
@McpTool()
@Injectable()
export class PaymentFindByIdMcpTool implements IMcpTool {
  private readonly logger = new Logger(PaymentFindByIdMcpTool.name);

  readonly name = 'payment_find_by_id';
  readonly title = 'Find payment by id';
  readonly description =
    'Returns a single payment by its id, or null if it does not exist.';
  readonly inputSchema = paymentFindByIdSchema;

  constructor(private readonly queryBus: QueryBus) {}

  async execute(args: Record<string, unknown>): Promise<CallToolResult> {
    const { id } = args as { id: string };
    this.logger.log(`Finding payment by id: ${id}`);

    const result = await this.queryBus.execute(
      new PaymentFindByIdQuery({ id }),
    );

    return {
      content: [{ type: 'text', text: JSON.stringify(result ?? null) }],
    };
  }
}
