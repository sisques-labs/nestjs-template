import { Injectable, Logger } from '@nestjs/common';
import { BaseDatabaseMapper } from '@sisques-labs/nestjs-kit';

import { UserAggregate } from '@contexts/users/domain/aggregates/user.aggregate';
import { UserBuilder } from '@contexts/users/domain/builders/user.builder';
import { UserViewModel } from '@contexts/users/domain/view-models/user.view-model';
import { UserEntity } from '@contexts/users/infrastructure/persistence/typeorm/entities/user.entity';

/**
 * `UserEntity` ↔ `UserAggregate`/`UserViewModel`. Extends
 * `BaseDatabaseMapper` (the engine-agnostic base), same reasoning as
 * `TenantTypeOrmMapper` — see that class's doc comment.
 */
@Injectable()
export class UserTypeOrmMapper extends BaseDatabaseMapper<
  UserAggregate,
  UserEntity
> {
  private readonly logger = new Logger(UserTypeOrmMapper.name);

  constructor(private readonly userBuilder: UserBuilder) {
    super();
  }

  toAggregate(entity: UserEntity): UserAggregate {
    this.logger.debug(`Mapping UserEntity ${entity.id} to UserAggregate`);
    return this.userBuilder
      .withId(entity.id)
      .withTenantId(entity.tenantId)
      .withExternalId(entity.externalId)
      .withEmail(entity.email)
      .withDisplayName(entity.displayName)
      .withAvatarUrl(entity.avatarUrl)
      .withCreatedAt(entity.createdAt)
      .withUpdatedAt(entity.updatedAt)
      .build();
  }

  toPersistence(aggregate: UserAggregate): UserEntity {
    const primitives = aggregate.toPrimitives();
    this.logger.debug(`Mapping UserAggregate ${primitives.id} to UserEntity`);
    const entity = new UserEntity();
    entity.id = primitives.id;
    entity.tenantId = primitives.tenantId;
    entity.externalId = primitives.externalId;
    entity.email = primitives.email;
    entity.displayName = primitives.displayName;
    entity.avatarUrl = primitives.avatarUrl;
    entity.createdAt = primitives.createdAt;
    entity.updatedAt = primitives.updatedAt;
    return entity;
  }

  toViewModel(entity: UserEntity): UserViewModel {
    this.logger.debug(`Mapping UserEntity ${entity.id} to UserViewModel`);
    return this.userBuilder
      .withId(entity.id)
      .withTenantId(entity.tenantId)
      .withExternalId(entity.externalId)
      .withEmail(entity.email)
      .withDisplayName(entity.displayName)
      .withAvatarUrl(entity.avatarUrl)
      .withCreatedAt(entity.createdAt)
      .withUpdatedAt(entity.updatedAt)
      .buildViewModel();
  }
}
