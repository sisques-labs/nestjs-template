import { Injectable, Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { IMcpTool, McpTool } from '@sisques-labs/nestjs-kit/mcp';
import { SubscriptionFindByIdQuery } from '@contexts/payments/application/queries/subscription-find-by-id/subscription-find-by-id.query';

import { subscriptionFindByIdSchema } from '../schemas/subscription-find-by-id.schema';

@McpTool()
@Injectable()
export class SubscriptionFindByIdMcpTool implements IMcpTool {
  private readonly logger = new Logger(SubscriptionFindByIdMcpTool.name);

  readonly name = 'subscription_find_by_id';
  readonly title = 'Find subscription by id';
  readonly description =
    'Returns a single subscription by its id, or null if it does not exist.';
  readonly inputSchema = subscriptionFindByIdSchema;

  constructor(private readonly queryBus: QueryBus) {}

  async execute(args: Record<string, unknown>): Promise<CallToolResult> {
    const { id } = args as { id: string };
    this.logger.log(`Finding subscription by id: ${id}`);

    const result = await this.queryBus.execute(
      new SubscriptionFindByIdQuery({ id }),
    );

    return {
      content: [{ type: 'text', text: JSON.stringify(result ?? null) }],
    };
  }
}
