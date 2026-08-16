import { Injectable } from '@nestjs/common';
import {
  BaseBuilder,
  BooleanValueObject,
  DateValueObject,
  FieldIsRequiredException,
  JsonValueObject,
  StringValueObject,
} from '@sisques-labs/nestjs-kit';

import { SubscriptionAggregate } from '@contexts/payments/domain/aggregates/subscription.aggregate';
import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { SubscriptionStatusEnum } from '@contexts/payments/domain/enums/subscription-status.enum';
import { SubscriptionViewModel } from '@contexts/payments/domain/view-models/subscription.view-model';
import { IdempotencyKeyValueObject } from '@contexts/payments/domain/value-objects/idempotency-key/idempotency-key.value-object';
import { PaymentProviderValueObject } from '@contexts/payments/domain/value-objects/payment-provider/payment-provider.value-object';
import { SubscriptionIdValueObject } from '@contexts/payments/domain/value-objects/subscription-id/subscription-id.value-object';
import { SubscriptionStatusValueObject } from '@contexts/payments/domain/value-objects/subscription-status/subscription-status.value-object';

@Injectable()
export class SubscriptionBuilder extends BaseBuilder<
  SubscriptionAggregate,
  SubscriptionViewModel
> {
  private _provider!: PaymentProviderEnum;
  private _providerSubscriptionId?: string;
  private _providerCustomerId?: string;
  private _customerId!: string;
  private _priceId!: string;
  private _status: SubscriptionStatusEnum = SubscriptionStatusEnum.INCOMPLETE;
  private _currentPeriodStart?: Date;
  private _currentPeriodEnd?: Date;
  private _cancelAtPeriodEnd = false;
  private _idempotencyKey!: string;
  private _metadata?: Record<string, unknown>;

  withProvider(provider: PaymentProviderEnum): this {
    this._provider = provider;
    return this;
  }

  withProviderSubscriptionId(providerSubscriptionId: string | undefined): this {
    this._providerSubscriptionId = providerSubscriptionId;
    return this;
  }

  withProviderCustomerId(providerCustomerId: string | undefined): this {
    this._providerCustomerId = providerCustomerId;
    return this;
  }

  withCustomerId(customerId: string): this {
    this._customerId = customerId;
    return this;
  }

  withPriceId(priceId: string): this {
    this._priceId = priceId;
    return this;
  }

  withStatus(status: SubscriptionStatusEnum): this {
    this._status = status;
    return this;
  }

  withCurrentPeriodStart(currentPeriodStart: Date | undefined): this {
    this._currentPeriodStart = currentPeriodStart;
    return this;
  }

  withCurrentPeriodEnd(currentPeriodEnd: Date | undefined): this {
    this._currentPeriodEnd = currentPeriodEnd;
    return this;
  }

  withCancelAtPeriodEnd(cancelAtPeriodEnd: boolean): this {
    this._cancelAtPeriodEnd = cancelAtPeriodEnd;
    return this;
  }

  withIdempotencyKey(idempotencyKey: string): this {
    this._idempotencyKey = idempotencyKey;
    return this;
  }

  withMetadata(metadata: Record<string, unknown> | undefined): this {
    this._metadata = metadata;
    return this;
  }

  public override build(): SubscriptionAggregate {
    this.validate();
    return new SubscriptionAggregate({
      id: new SubscriptionIdValueObject(this._id),
      provider: new PaymentProviderValueObject(this._provider),
      providerSubscriptionId: this._providerSubscriptionId
        ? new StringValueObject(this._providerSubscriptionId)
        : undefined,
      providerCustomerId: this._providerCustomerId
        ? new StringValueObject(this._providerCustomerId)
        : undefined,
      customerId: new StringValueObject(this._customerId),
      priceId: new StringValueObject(this._priceId),
      status: new SubscriptionStatusValueObject(this._status),
      currentPeriodStart: this._currentPeriodStart
        ? new DateValueObject(this._currentPeriodStart)
        : undefined,
      currentPeriodEnd: this._currentPeriodEnd
        ? new DateValueObject(this._currentPeriodEnd)
        : undefined,
      cancelAtPeriodEnd: new BooleanValueObject(this._cancelAtPeriodEnd),
      idempotencyKey: new IdempotencyKeyValueObject(this._idempotencyKey),
      metadata: this._metadata
        ? new JsonValueObject(this._metadata)
        : undefined,
      createdAt: new DateValueObject(this._createdAt),
      updatedAt: new DateValueObject(this._updatedAt),
    });
  }

  public override buildViewModel(): SubscriptionViewModel {
    this.validate();
    return new SubscriptionViewModel({
      id: this._id,
      provider: this._provider,
      providerSubscriptionId: this._providerSubscriptionId,
      providerCustomerId: this._providerCustomerId,
      customerId: this._customerId,
      priceId: this._priceId,
      status: this._status,
      currentPeriodStart: this._currentPeriodStart,
      currentPeriodEnd: this._currentPeriodEnd,
      cancelAtPeriodEnd: this._cancelAtPeriodEnd,
      idempotencyKey: this._idempotencyKey,
      metadata: this._metadata,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    });
  }

  public override validate(): void {
    super.validate();
    if (!this._provider) throw new FieldIsRequiredException('provider');
    if (!this._customerId) throw new FieldIsRequiredException('customerId');
    if (!this._priceId) throw new FieldIsRequiredException('priceId');
    if (!this._status) throw new FieldIsRequiredException('status');
    if (!this._idempotencyKey) {
      throw new FieldIsRequiredException('idempotencyKey');
    }
  }
}
