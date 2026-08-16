import { Injectable, Logger } from '@nestjs/common';
import { BaseDatabaseMapper } from '@sisques-labs/nestjs-kit';

import { TenantAggregate } from '@contexts/tenant/domain/aggregates/tenant.aggregate';
import { TenantBuilder } from '@contexts/tenant/domain/builders/tenant.builder';
import { TenantViewModel } from '@contexts/tenant/domain/view-models/tenant.view-model';
import { TenantEntity } from '@contexts/tenant/infrastructure/persistence/typeorm/entities/tenant.entity';

/**
 * `TenantEntity` ↔ `TenantAggregate`/`TenantViewModel`.
 *
 * Extends `BaseDatabaseMapper` (the engine-agnostic base, not
 * `BaseTypeOrmMapper`) — `BaseTypeOrmMapper`'s `TEntity` generic is
 * constrained to `extends BaseTypeormEntity`, which `TenantEntity`
 * deliberately doesn't extend (see the comment on `tenant.entity.ts`).
 *
 * `TenantBuilder` is constructor-injected rather than instantiated inline
 * with `new TenantBuilder()`. Reusing the single injected instance across
 * multiple `toAggregate()` calls is safe even though `TenantBuilder` is
 * internally mutable: every field it holds (`id`, `externalId`,
 * `createdAt`, `updatedAt`) is fully overwritten by the `.withX()` chain
 * before each `build()` call, and calls are synchronous, so no prior
 * call's state can leak into the next one. See the mapper's own spec for a
 * test that exercises exactly this — two `toAggregate()` calls on the same
 * mapper instance producing two independently-correct aggregates.
 */
@Injectable()
export class TenantTypeOrmMapper extends BaseDatabaseMapper<
  TenantAggregate,
  TenantEntity
> {
  private readonly logger = new Logger(TenantTypeOrmMapper.name);

  constructor(private readonly tenantBuilder: TenantBuilder) {
    super();
  }

  toAggregate(entity: TenantEntity): TenantAggregate {
    this.logger.debug(`Mapping TenantEntity ${entity.id} to TenantAggregate`);
    return this.tenantBuilder
      .withId(entity.id)
      .withExternalId(entity.externalId)
      .withCreatedAt(entity.createdAt)
      .withUpdatedAt(entity.updatedAt)
      .build();
  }

  toPersistence(aggregate: TenantAggregate): TenantEntity {
    const primitives = aggregate.toPrimitives();
    this.logger.debug(
      `Mapping TenantAggregate ${primitives.id} to TenantEntity`,
    );
    const entity = new TenantEntity();
    entity.id = primitives.id;
    entity.externalId = primitives.externalId;
    entity.createdAt = primitives.createdAt;
    entity.updatedAt = primitives.updatedAt;
    return entity;
  }

  toViewModel(entity: TenantEntity): TenantViewModel {
    this.logger.debug(`Mapping TenantEntity ${entity.id} to TenantViewModel`);
    return new TenantViewModel({
      id: entity.id,
      externalId: entity.externalId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
