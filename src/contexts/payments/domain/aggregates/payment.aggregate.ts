import {
  BaseAggregate,
  NumberValueObject,
  StringValueObject,
} from '@sisques-labs/nestjs-kit';

import { PaymentFailedEvent } from '@contexts/payments/domain/events/payment-failed/payment-failed.event';
import { PaymentCreatedEvent } from '@contexts/payments/domain/events/payment-created/payment-created.event';
import { PaymentRefundedEvent } from '@contexts/payments/domain/events/payment-refunded/payment-refunded.event';
import { PaymentSucceededEvent } from '@contexts/payments/domain/events/payment-succeeded/payment-succeeded.event';
import { PaymentStatusEnum } from '@contexts/payments/domain/enums/payment-status.enum';
import { RefundExceedsPaymentAmountException } from '@contexts/payments/domain/exceptions/refund-exceeds-payment-amount.exception';
import { IPayment } from '@contexts/payments/domain/interfaces/payment.interface';
import { IPaymentPrimitives } from '@contexts/payments/domain/primitives/payment.primitives';
import { PaymentStatusValueObject } from '@contexts/payments/domain/value-objects/payment-status/payment-status.value-object';

/**
 * A one-off payment intent/charge against a provider (e.g. Stripe).
 * Refunds are a state transition on this aggregate (`refund()`), not a
 * separate entity — a refund has no independent lifecycle from its payment.
 */
export class PaymentAggregate extends BaseAggregate {
  private readonly _id: IPayment['id'];
  private readonly _provider: IPayment['provider'];
  private _providerPaymentId?: StringValueObject;
  private readonly _customerId: StringValueObject;
  private readonly _amount: IPayment['amount'];
  private readonly _currency: IPayment['currency'];
  private _status: PaymentStatusValueObject;
  private readonly _idempotencyKey: IPayment['idempotencyKey'];
  private _refundedAmount: NumberValueObject;
  private readonly _description?: StringValueObject;
  private readonly _metadata?: IPayment['metadata'];

  constructor(props: IPayment) {
    super(props.createdAt, props.updatedAt);
    this._id = props.id;
    this._provider = props.provider;
    this._providerPaymentId = props.providerPaymentId;
    this._customerId = props.customerId;
    this._amount = props.amount;
    this._currency = props.currency;
    this._status = props.status;
    this._idempotencyKey = props.idempotencyKey;
    this._refundedAmount = props.refundedAmount;
    this._description = props.description;
    this._metadata = props.metadata;
  }

  public create(): void {
    this.apply(
      new PaymentCreatedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: PaymentAggregate.name,
          entityId: this._id.value,
          entityType: PaymentAggregate.name,
          eventType: PaymentCreatedEvent.name,
        },
        this.toPrimitives(),
      ),
    );
  }

  public markSucceeded(providerPaymentId: string): void {
    this._providerPaymentId = new StringValueObject(providerPaymentId);
    this._status = new PaymentStatusValueObject(PaymentStatusEnum.SUCCEEDED);
    this.touch();
    this.apply(
      new PaymentSucceededEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: PaymentAggregate.name,
          entityId: this._id.value,
          entityType: PaymentAggregate.name,
          eventType: PaymentSucceededEvent.name,
        },
        this.toPrimitives(),
      ),
    );
  }

  public markFailed(): void {
    this._status = new PaymentStatusValueObject(PaymentStatusEnum.FAILED);
    this.touch();
    this.apply(
      new PaymentFailedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: PaymentAggregate.name,
          entityId: this._id.value,
          entityType: PaymentAggregate.name,
          eventType: PaymentFailedEvent.name,
        },
        this.toPrimitives(),
      ),
    );
  }

  /**
   * Refunds `amount` (defaults to the full remaining unrefunded amount).
   * Rejects a refund that would push `refundedAmount` past `amount`.
   */
  public refund(amount?: number): void {
    const remaining = this._amount.value - this._refundedAmount.value;
    const refundAmount = amount ?? remaining;

    if (refundAmount <= 0 || refundAmount > remaining) {
      throw new RefundExceedsPaymentAmountException(this._id.value);
    }

    const newRefundedAmount = this._refundedAmount.value + refundAmount;
    this._refundedAmount = new NumberValueObject(newRefundedAmount, {
      min: 0,
      allowDecimals: false,
    });
    this._status = new PaymentStatusValueObject(
      newRefundedAmount >= this._amount.value
        ? PaymentStatusEnum.REFUNDED
        : PaymentStatusEnum.PARTIALLY_REFUNDED,
    );
    this.touch();

    this.apply(
      new PaymentRefundedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: PaymentAggregate.name,
          entityId: this._id.value,
          entityType: PaymentAggregate.name,
          eventType: PaymentRefundedEvent.name,
        },
        this.toPrimitives(),
      ),
    );
  }

  public get id(): string {
    return this._id.value;
  }

  public get status(): PaymentStatusEnum {
    return this._status.value as PaymentStatusEnum;
  }

  public toPrimitives(): IPaymentPrimitives {
    return {
      id: this._id.value,
      provider: this._provider.value as IPaymentPrimitives['provider'],
      providerPaymentId: this._providerPaymentId?.value,
      customerId: this._customerId.value,
      amount: this._amount.value,
      currency: this._currency.value as IPaymentPrimitives['currency'],
      status: this._status.value as IPaymentPrimitives['status'],
      idempotencyKey: this._idempotencyKey.value,
      refundedAmount: this._refundedAmount.value,
      description: this._description?.value,
      metadata: this._metadata?.value,
      createdAt: this.createdAt.value,
      updatedAt: this.updatedAt.value,
    };
  }
}
