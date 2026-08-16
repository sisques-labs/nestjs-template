import {
  BaseAggregate,
  BooleanValueObject,
  DateValueObject,
} from '@sisques-labs/nestjs-kit';

import { SubscriptionCanceledEvent } from '@contexts/payments/domain/events/subscription-canceled/subscription-canceled.event';
import { SubscriptionCreatedEvent } from '@contexts/payments/domain/events/subscription-created/subscription-created.event';
import { SubscriptionStatusChangedEvent } from '@contexts/payments/domain/events/subscription-status-changed/subscription-status-changed.event';
import { SubscriptionStatusEnum } from '@contexts/payments/domain/enums/subscription-status.enum';
import { ISubscription } from '@contexts/payments/domain/interfaces/subscription.interface';
import { ISubscriptionPrimitives } from '@contexts/payments/domain/primitives/subscription.primitives';
import { SubscriptionStatusValueObject } from '@contexts/payments/domain/value-objects/subscription-status/subscription-status.value-object';

/**
 * A recurring billing subscription. Status transitions are driven by the
 * provider's own webhooks via `syncStatus()` — this aggregate never
 * self-assigns a status the provider hasn't confirmed. `cancel()` only
 * records the intent (`cancelAtPeriodEnd`); the actual CANCELED status
 * arrives later through `syncStatus()`.
 */
export class SubscriptionAggregate extends BaseAggregate {
  private readonly _id: ISubscription['id'];
  private readonly _provider: ISubscription['provider'];
  private readonly _providerSubscriptionId?: ISubscription['providerSubscriptionId'];
  private readonly _providerCustomerId?: ISubscription['providerCustomerId'];
  private readonly _customerId: ISubscription['customerId'];
  private readonly _priceId: ISubscription['priceId'];
  private _status: SubscriptionStatusValueObject;
  private _currentPeriodStart?: DateValueObject;
  private _currentPeriodEnd?: DateValueObject;
  private _cancelAtPeriodEnd: BooleanValueObject;
  private readonly _idempotencyKey: ISubscription['idempotencyKey'];
  private readonly _metadata?: ISubscription['metadata'];

  constructor(props: ISubscription) {
    super(props.createdAt, props.updatedAt);
    this._id = props.id;
    this._provider = props.provider;
    this._providerSubscriptionId = props.providerSubscriptionId;
    this._providerCustomerId = props.providerCustomerId;
    this._customerId = props.customerId;
    this._priceId = props.priceId;
    this._status = props.status;
    this._currentPeriodStart = props.currentPeriodStart;
    this._currentPeriodEnd = props.currentPeriodEnd;
    this._cancelAtPeriodEnd = props.cancelAtPeriodEnd;
    this._idempotencyKey = props.idempotencyKey;
    this._metadata = props.metadata;
  }

  public create(): void {
    this.apply(
      new SubscriptionCreatedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: SubscriptionAggregate.name,
          entityId: this._id.value,
          entityType: SubscriptionAggregate.name,
          eventType: SubscriptionCreatedEvent.name,
        },
        this.toPrimitives(),
      ),
    );
  }

  /**
   * Applies the provider's authoritative status (and, when provided, the
   * current billing period) from a webhook event. Emits
   * `SubscriptionStatusChanged` only when `status` actually differs from the
   * current one — a redelivered event with the same status is a no-op event
   * (though the caller's dedup log is what prevents double-processing).
   */
  public syncStatus(
    status: SubscriptionStatusEnum,
    currentPeriodStart?: Date,
    currentPeriodEnd?: Date,
  ): void {
    const statusChanged = this._status.value !== status;

    if (currentPeriodStart) {
      this._currentPeriodStart = new DateValueObject(currentPeriodStart);
    }
    if (currentPeriodEnd) {
      this._currentPeriodEnd = new DateValueObject(currentPeriodEnd);
    }

    if (!statusChanged) {
      return;
    }

    this._status = new SubscriptionStatusValueObject(status);
    this.touch();

    this.apply(
      new SubscriptionStatusChangedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: SubscriptionAggregate.name,
          entityId: this._id.value,
          entityType: SubscriptionAggregate.name,
          eventType: SubscriptionStatusChangedEvent.name,
        },
        this.toPrimitives(),
      ),
    );
  }

  public cancel(cancelAtPeriodEnd: boolean): void {
    this._cancelAtPeriodEnd = new BooleanValueObject(cancelAtPeriodEnd);
    this.touch();

    this.apply(
      new SubscriptionCanceledEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: SubscriptionAggregate.name,
          entityId: this._id.value,
          entityType: SubscriptionAggregate.name,
          eventType: SubscriptionCanceledEvent.name,
        },
        this.toPrimitives(),
      ),
    );
  }

  public get id(): string {
    return this._id.value;
  }

  public get status(): SubscriptionStatusEnum {
    return this._status.value as SubscriptionStatusEnum;
  }

  public toPrimitives(): ISubscriptionPrimitives {
    return {
      id: this._id.value,
      provider: this._provider.value as ISubscriptionPrimitives['provider'],
      providerSubscriptionId: this._providerSubscriptionId?.value,
      providerCustomerId: this._providerCustomerId?.value,
      customerId: this._customerId.value,
      priceId: this._priceId.value,
      status: this._status.value as ISubscriptionPrimitives['status'],
      currentPeriodStart: this._currentPeriodStart?.value,
      currentPeriodEnd: this._currentPeriodEnd?.value,
      cancelAtPeriodEnd: this._cancelAtPeriodEnd.value,
      idempotencyKey: this._idempotencyKey.value,
      metadata: this._metadata?.value,
      createdAt: this.createdAt.value,
      updatedAt: this.updatedAt.value,
    };
  }
}
