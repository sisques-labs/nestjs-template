import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request } from 'express';

import { ProcessPaymentProviderWebhookEventCommand } from '@contexts/payments/application/commands/process-payment-provider-webhook-event/process-payment-provider-webhook-event.command';

/**
 * Inbound Stripe webhooks. Deliberately REST-only (no GraphQL equivalent —
 * see the design doc) and unauthenticated by design: the payload's own
 * signature (verified by `IPaymentProviderPort.verifyWebhookSignature`
 * inside the command handler) is the trust boundary here, not a session.
 *
 * Requires `{ rawBody: true }` on `NestFactory.create` in `main.ts` so
 * `req.rawBody` holds the exact bytes Stripe signed — the global JSON body
 * parser would otherwise re-serialize the payload and break verification.
 */
@ApiExcludeController()
@Controller('payments/webhooks')
export class PaymentsWebhooksController {
  private readonly logger = new Logger(PaymentsWebhooksController.name);

  constructor(private readonly commandBus: CommandBus) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: true }> {
    this.logger.log('Received Stripe webhook');

    await this.commandBus.execute(
      new ProcessPaymentProviderWebhookEventCommand({
        rawBody: req.rawBody ?? Buffer.from(''),
        signature,
      }),
    );

    return { received: true };
  }
}
