import { Injectable, Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Criteria } from '@sisques-labs/nestjs-kit';

import { IMcpTool, McpTool } from '@sisques-labs/nestjs-kit/mcp';
import { SubscriptionFindByCriteriaQuery } from '@contexts/payments/application/queries/subscription-find-by-criteria/subscription-find-by-criteria.query';

import { subscriptionFindByCriteriaSchema } from '../schemas/subscription-find-by-criteria.schema';

@McpTool()
@Injectable()
export class SubscriptionFindByCriteriaMcpTool implements IMcpTool {
  private readonly logger = new Logger(SubscriptionFindByCriteriaMcpTool.name);

  readonly name = 'subscription_find_by_criteria';
  readonly title = 'List subscriptions';
  readonly description = 'Returns a paginated list of subscriptions.';
  readonly inputSchema = subscriptionFindByCriteriaSchema;

  constructor(private readonly queryBus: QueryBus) {}

  async execute(args: Record<string, unknown>): Promise<CallToolResult> {
    const { page, perPage } = args as { page?: number; perPage?: number };
    this.logger.log(
      `Finding subscriptions: page=${page ?? '-'} perPage=${perPage ?? '-'}`,
    );

    const pagination =
      page !== undefined && perPage !== undefined
        ? { page, perPage }
        : undefined;
    const criteria = new Criteria(undefined, undefined, pagination);

    const result = await this.queryBus.execute(
      new SubscriptionFindByCriteriaQuery(criteria),
    );

    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
}
