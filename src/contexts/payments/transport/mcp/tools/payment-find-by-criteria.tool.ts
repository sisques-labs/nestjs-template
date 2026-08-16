import { Injectable, Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Criteria } from '@sisques-labs/nestjs-kit';

import { IMcpTool, McpTool } from '@sisques-labs/nestjs-kit/mcp';
import { PaymentFindByCriteriaQuery } from '@contexts/payments/application/queries/payment-find-by-criteria/payment-find-by-criteria.query';

import { paymentFindByCriteriaSchema } from '../schemas/payment-find-by-criteria.schema';

@McpTool()
@Injectable()
export class PaymentFindByCriteriaMcpTool implements IMcpTool {
  private readonly logger = new Logger(PaymentFindByCriteriaMcpTool.name);

  readonly name = 'payment_find_by_criteria';
  readonly title = 'List payments';
  readonly description = 'Returns a paginated list of payments.';
  readonly inputSchema = paymentFindByCriteriaSchema;

  constructor(private readonly queryBus: QueryBus) {}

  async execute(args: Record<string, unknown>): Promise<CallToolResult> {
    const { page, perPage } = args as { page?: number; perPage?: number };
    this.logger.log(
      `Finding payments: page=${page ?? '-'} perPage=${perPage ?? '-'}`,
    );

    const pagination =
      page !== undefined && perPage !== undefined
        ? { page, perPage }
        : undefined;
    const criteria = new Criteria(undefined, undefined, pagination);

    const result = await this.queryBus.execute(
      new PaymentFindByCriteriaQuery(criteria),
    );

    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
}
