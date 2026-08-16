import { Injectable } from '@nestjs/common';
import {
  BaseBuilder,
  DateValueObject,
  FieldIsRequiredException,
  JsonValueObject,
  NumberValueObject,
  StringValueObject,
} from '@sisques-labs/nestjs-kit';

import { PaymentAggregate } from '@contexts/payments/domain/aggregates/payment.aggregate';
import { CurrencyEnum } from '@contexts/payments/domain/enums/currency.enum';
import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { PaymentStatusEnum } from '@contexts/payments/domain/enums/payment-status.enum';
import { PaymentViewModel } from '@contexts/payments/domain/view-models/payment.view-model';
import { CurrencyValueObject } from '@contexts/payments/domain/value-objects/currency/currency.value-object';
import { IdempotencyKeyValueObject } from '@contexts/payments/domain/value-objects/idempotency-key/idempotency-key.value-object';
import { PaymentAmountValueObject } from '@contexts/payments/domain/value-objects/payment-amount/payment-amount.value-object';
import { PaymentIdValueObject } from '@contexts/payments/domain/value-objects/payment-id/payment-id.value-object';
import { PaymentProviderValueObject } from '@contexts/payments/domain/value-objects/payment-provider/payment-provider.value-object';
import { PaymentStatusValueObject } from '@contexts/payments/domain/value-objects/payment-status/payment-status.value-object';

@Injectable()
export class PaymentBuilder extends BaseBuilder<
  PaymentAggregate,
  PaymentViewModel
> {
  private _provider!: PaymentProviderEnum;
  private _providerPaymentId?: string;
  private _customerId!: string;
  private _amount!: number;
  private _currency!: CurrencyEnum;
  private _status: PaymentStatusEnum = PaymentStatusEnum.PENDING;
  private _idempotencyKey!: string;
  private _refundedAmount = 0;
  private _description?: string;
  private _metadata?: Record<string, unknown>;

  withProvider(provider: PaymentProviderEnum): this {
    this._provider = provider;
    return this;
  }

  withProviderPaymentId(providerPaymentId: string | undefined): this {
    this._providerPaymentId = providerPaymentId;
    return this;
  }

  withCustomerId(customerId: string): this {
    this._customerId = customerId;
    return this;
  }

  withAmount(amount: number): this {
    this._amount = amount;
    return this;
  }

  withCurrency(currency: CurrencyEnum): this {
    this._currency = currency;
    return this;
  }

  withStatus(status: PaymentStatusEnum): this {
    this._status = status;
    return this;
  }

  withIdempotencyKey(idempotencyKey: string): this {
    this._idempotencyKey = idempotencyKey;
    return this;
  }

  withRefundedAmount(refundedAmount: number): this {
    this._refundedAmount = refundedAmount;
    return this;
  }

  withDescription(description: string | undefined): this {
    this._description = description;
    return this;
  }

  withMetadata(metadata: Record<string, unknown> | undefined): this {
    this._metadata = metadata;
    return this;
  }

  public override build(): PaymentAggregate {
    this.validate();
    return new PaymentAggregate({
      id: new PaymentIdValueObject(this._id),
      provider: new PaymentProviderValueObject(this._provider),
      providerPaymentId: this._providerPaymentId
        ? new StringValueObject(this._providerPaymentId)
        : undefined,
      customerId: new StringValueObject(this._customerId),
      amount: new PaymentAmountValueObject(this._amount),
      currency: new CurrencyValueObject(this._currency),
      status: new PaymentStatusValueObject(this._status),
      idempotencyKey: new IdempotencyKeyValueObject(this._idempotencyKey),
      refundedAmount: new NumberValueObject(this._refundedAmount, {
        min: 0,
        allowDecimals: false,
      }),
      description: this._description
        ? new StringValueObject(this._description)
        : undefined,
      metadata: this._metadata
        ? new JsonValueObject(this._metadata)
        : undefined,
      createdAt: new DateValueObject(this._createdAt),
      updatedAt: new DateValueObject(this._updatedAt),
    });
  }

  public override buildViewModel(): PaymentViewModel {
    this.validate();
    return new PaymentViewModel({
      id: this._id,
      provider: this._provider,
      providerPaymentId: this._providerPaymentId,
      customerId: this._customerId,
      amount: this._amount,
      currency: this._currency,
      status: this._status,
      idempotencyKey: this._idempotencyKey,
      refundedAmount: this._refundedAmount,
      description: this._description,
      metadata: this._metadata,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    });
  }

  public override validate(): void {
    super.validate();
    if (!this._provider) throw new FieldIsRequiredException('provider');
    if (!this._customerId) throw new FieldIsRequiredException('customerId');
    if (this._amount === undefined) {
      throw new FieldIsRequiredException('amount');
    }
    if (!this._currency) throw new FieldIsRequiredException('currency');
    if (!this._status) throw new FieldIsRequiredException('status');
    if (!this._idempotencyKey) {
      throw new FieldIsRequiredException('idempotencyKey');
    }
  }
}
