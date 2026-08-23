import { Injectable } from '@nestjs/common';
import {
  BaseBuilder,
  DateValueObject,
  EmailValueObject,
  FieldIsRequiredException,
} from '@sisques-labs/nestjs-kit';
import { UserAggregate } from '@contexts/users/domain/aggregates/user.aggregate';
import { UserDisplayNameValueObject } from '@contexts/users/domain/value-objects/user-display-name/user-display-name.vo';
import { UserExternalIdValueObject } from '@contexts/users/domain/value-objects/user-external-id/user-external-id.vo';
import { UserIdValueObject } from '@contexts/users/domain/value-objects/user-id/user-id.vo';
import { UserTenantIdValueObject } from '@contexts/users/domain/value-objects/user-tenant-id/user-tenant-id.vo';
import { UserViewModel } from '@contexts/users/domain/view-models/user.view-model';

/**
 * Builds a `UserAggregate` (or its `UserViewModel` projection) from
 * primitive inputs. The only supported way to construct a `UserAggregate`
 * — no static factory methods on the aggregate itself. `@Injectable()` so
 * it can be constructor-injected (e.g. by `UserTypeOrmMapper`) instead of
 * instantiated inline with `new UserBuilder()`.
 */
@Injectable()
export class UserBuilder extends BaseBuilder<UserAggregate, UserViewModel> {
  private _tenantId!: string;
  private _externalId!: string;
  private _email: string | null = null;
  private _displayName!: string;

  withTenantId(tenantId: string): this {
    this._tenantId = tenantId;
    return this;
  }

  withExternalId(externalId: string): this {
    this._externalId = externalId;
    return this;
  }

  withEmail(email: string | null): this {
    this._email = email;
    return this;
  }

  withDisplayName(displayName: string): this {
    this._displayName = displayName;
    return this;
  }

  override validate(): void {
    super.validate();
    if (!this._tenantId) {
      throw new FieldIsRequiredException('tenantId');
    }
    if (!this._externalId) {
      throw new FieldIsRequiredException('externalId');
    }
    if (!this._displayName) {
      throw new FieldIsRequiredException('displayName');
    }
  }

  build(): UserAggregate {
    this.validate();
    return new UserAggregate({
      id: new UserIdValueObject(this._id),
      tenantId: new UserTenantIdValueObject(this._tenantId),
      externalId: new UserExternalIdValueObject(this._externalId),
      email: this._email ? new EmailValueObject(this._email) : null,
      displayName: new UserDisplayNameValueObject(this._displayName),
      createdAt: new DateValueObject(this._createdAt),
      updatedAt: new DateValueObject(this._updatedAt),
    });
  }

  buildViewModel(): UserViewModel {
    this.validate();
    return new UserViewModel({
      id: this._id,
      tenantId: this._tenantId,
      externalId: this._externalId,
      email: this._email,
      displayName: this._displayName,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    });
  }
}
