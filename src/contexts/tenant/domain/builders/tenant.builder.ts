import { Injectable } from '@nestjs/common';
import {
  BaseBuilder,
  DateValueObject,
  FieldIsRequiredException,
} from '@sisques-labs/nestjs-kit';
import { TenantAggregate } from '@contexts/tenant/domain/aggregates/tenant.aggregate';
import { TenantExternalIdValueObject } from '@contexts/tenant/domain/value-objects/tenant-external-id/tenant-external-id.vo';
import { TenantIdValueObject } from '@contexts/tenant/domain/value-objects/tenant-id/tenant-id.vo';
import { TenantViewModel } from '@contexts/tenant/domain/view-models/tenant.view-model';

/**
 * Builds a `TenantAggregate` (or its `TenantViewModel` projection) from
 * primitive inputs. The only supported way to construct a `TenantAggregate`
 * — no static factory methods on the aggregate itself. `@Injectable()` so
 * it can be constructor-injected (e.g. by `TenantTypeOrmMapper`) instead of
 * instantiated inline with `new TenantBuilder()`.
 */
@Injectable()
export class TenantBuilder extends BaseBuilder<
  TenantAggregate,
  TenantViewModel
> {
  private _externalId!: string;

  withExternalId(externalId: string): this {
    this._externalId = externalId;
    return this;
  }

  override validate(): void {
    super.validate();
    if (!this._externalId) {
      throw new FieldIsRequiredException('externalId');
    }
  }

  build(): TenantAggregate {
    this.validate();
    return new TenantAggregate({
      id: new TenantIdValueObject(this._id),
      externalId: new TenantExternalIdValueObject(this._externalId),
      createdAt: new DateValueObject(this._createdAt),
      updatedAt: new DateValueObject(this._updatedAt),
    });
  }

  buildViewModel(): TenantViewModel {
    this.validate();
    return new TenantViewModel({
      id: this._id,
      externalId: this._externalId,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    });
  }
}
