import {
  BaseBuilder,
  FieldIsRequiredException,
} from '@sisques-labs/nestjs-kit';
import { TenantAggregate } from '@contexts/tenant/domain/aggregates/tenant.aggregate';
import { TenantViewModel } from '@contexts/tenant/domain/view-models/tenant.view-model';

/**
 * Builds a `TenantAggregate` (or its `TenantViewModel` projection) from
 * primitive inputs. The only supported way to construct a `TenantAggregate`
 * — no static factory methods on the aggregate itself.
 */
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
      id: this._id,
      externalId: this._externalId,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    });
  }

  buildViewModel(): TenantViewModel {
    this.validate();
    return new TenantViewModel(
      this._id,
      this._externalId,
      this._createdAt,
      this._updatedAt,
    );
  }
}
