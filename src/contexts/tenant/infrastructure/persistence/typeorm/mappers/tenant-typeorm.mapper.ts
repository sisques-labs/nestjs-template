import { Injectable } from '@nestjs/common';
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
 */
@Injectable()
export class TenantTypeOrmMapper extends BaseDatabaseMapper<
  TenantAggregate,
  TenantEntity
> {
  toAggregate(entity: TenantEntity): TenantAggregate {
    return new TenantBuilder()
      .withId(entity.id)
      .withExternalId(entity.externalId)
      .withCreatedAt(entity.createdAt)
      .withUpdatedAt(entity.updatedAt)
      .build();
  }

  toPersistence(aggregate: TenantAggregate): TenantEntity {
    const primitives = aggregate.toPrimitives();
    const entity = new TenantEntity();
    entity.id = primitives.id;
    entity.externalId = primitives.externalId;
    entity.createdAt = primitives.createdAt;
    entity.updatedAt = primitives.updatedAt;
    return entity;
  }

  toViewModel(entity: TenantEntity): TenantViewModel {
    return new TenantViewModel(
      entity.id,
      entity.externalId,
      entity.createdAt,
      entity.updatedAt,
    );
  }
}
