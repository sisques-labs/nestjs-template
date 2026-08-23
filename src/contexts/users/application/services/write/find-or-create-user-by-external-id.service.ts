import { Inject, Injectable } from '@nestjs/common';
import { EmailValueObject, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { UserAggregate } from '@contexts/users/domain/aggregates/user.aggregate';
import { UserBuilder } from '@contexts/users/domain/builders/user.builder';
import {
  IUserWriteRepository,
  USER_WRITE_REPOSITORY,
} from '@contexts/users/domain/repositories/write/user-write.repository';
import { UserExternalIdValueObject } from '@contexts/users/domain/value-objects/user-external-id/user-external-id.vo';
import { UserTenantIdValueObject } from '@contexts/users/domain/value-objects/user-tenant-id/user-tenant-id.vo';

/**
 * Find-or-create by `(tenantId, externalId)`, re-syncing `email` on every
 * call per the `user-profile` spec's email-resync requirement — `email` is
 * entirely IdP-derived, never user-editable, so a stale local copy would
 * be a correctness bug. The email write is itself skipped when the
 * supplied value already matches the stored one, so a returning user's
 * every request doesn't force a database write when nothing changed.
 *
 * Returns the resulting `UserAggregate` — deliberately the **in-memory**
 * aggregate that had `create()`/`syncEmail()` called on it, not
 * `IUserWriteRepository.save()`'s own return value. `save()` (like
 * `TenantTypeOrmWriteRepository.save()`) remaps the persisted row back
 * through the mapper into a freshly-hydrated aggregate, which — being
 * constructed via `UserBuilder.build()` (hydration only) — never carries
 * any uncommitted events. Returning that remapped instance instead of the
 * original would silently make `UserCreatedEvent` unpublishable by any
 * caller checking `getUncommittedEvents()` after this call, since the
 * event only ever existed on the pre-save instance. Returning the
 * original preserves it for the caller (`UpsertUserFromClaimHandler`/
 * `UpdateUserDisplayNameHandler`) to publish, while the persisted values
 * still match exactly what the original held (nothing server-side
 * mutates them).
 */
@Injectable()
export class FindOrCreateUserByExternalIdService {
  constructor(
    @Inject(USER_WRITE_REPOSITORY)
    private readonly userWriteRepository: IUserWriteRepository,
  ) {}

  async execute(
    tenantId: UserTenantIdValueObject,
    externalId: UserExternalIdValueObject,
    email: EmailValueObject | null,
  ): Promise<UserAggregate> {
    const existing = await this.userWriteRepository.findByExternalId(
      tenantId,
      externalId,
    );

    if (existing) {
      if ((existing.email?.value ?? null) !== (email?.value ?? null)) {
        existing.syncEmail(email);
        await this.userWriteRepository.save(existing);
      }
      return existing;
    }

    const user = new UserBuilder()
      .withId(UuidValueObject.generate().value)
      .withTenantId(tenantId.value)
      .withExternalId(externalId.value)
      .withEmail(email?.value ?? null)
      .withDisplayName(defaultDisplayName(email, externalId))
      .withCreatedAt(new Date())
      .withUpdatedAt(new Date())
      .build();

    user.create();
    await this.userWriteRepository.save(user);

    return user;
  }
}

/** Defaults a brand-new `User`'s `displayName` to the email's local part
 * when an email claim is present, otherwise the raw `externalId` — see
 * `user-profile` spec's "displayName default" scenarios. Only used at
 * creation; `rename()` is the only thing that changes it afterward. */
function defaultDisplayName(
  email: EmailValueObject | null,
  externalId: UserExternalIdValueObject,
): string {
  return email ? email.getLocalPart() : externalId.value;
}
