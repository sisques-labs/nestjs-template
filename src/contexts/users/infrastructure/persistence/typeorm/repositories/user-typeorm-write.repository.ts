import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BaseDatabaseRepository,
  Criteria,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';
import { Repository } from 'typeorm';

import { UserAggregate } from '@contexts/users/domain/aggregates/user.aggregate';
import { IUserWriteRepository } from '@contexts/users/domain/repositories/write/user-write.repository';
import { UserExternalIdValueObject } from '@contexts/users/domain/value-objects/user-external-id/user-external-id.vo';
import { UserTenantIdValueObject } from '@contexts/users/domain/value-objects/user-tenant-id/user-tenant-id.vo';
import { UserEntity } from '@contexts/users/infrastructure/persistence/typeorm/entities/user.entity';
import { UserTypeOrmMapper } from '@contexts/users/infrastructure/persistence/typeorm/mappers/user-typeorm.mapper';

/**
 * `IUserWriteRepository` implementation. Composes a directly
 * `@InjectRepository`-supplied `Repository<UserEntity>` rather than
 * extending `BaseTypeormMasterRepository`, same reasoning as
 * `TenantTypeOrmWriteRepository` — see that class's doc comment.
 *
 * Deliberately does NOT use `createTenantScopedRepository()` (unlike
 * `UserTypeOrmReadRepository`): every method on `IUserWriteRepository`
 * either takes `tenantId` explicitly (`findByExternalId`) or receives an
 * aggregate whose `tenantId` is already set (`save`) — there is no
 * ambient-context-dependent call here, so wrapping would only add a
 * hidden `TenantContextService` dependency for no benefit, and would
 * make this repository harder to unit test in isolation.
 */
@Injectable()
export class UserTypeOrmWriteRepository
  extends BaseDatabaseRepository
  implements IUserWriteRepository
{
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
    private readonly mapper: UserTypeOrmMapper,
  ) {
    super();
    this.logger = new Logger(UserTypeOrmWriteRepository.name);
  }

  /**
   * Not tenant-scoped — `id` alone is already globally unique, and no
   * caller in this context's v1 command handlers uses this method
   * (present only to satisfy `IBaseWriteRepository`'s contract; the
   * find-or-create flow uses `findByExternalId` below instead). A future
   * caller that resolves an id from outside the current request's own
   * tenant should not rely on this method assuming tenant safety.
   */
  async findById(id: string): Promise<UserAggregate | null> {
    this.logger.debug(`Finding User by id ${id}`);
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toAggregate(entity) : null;
  }

  async findByExternalId(
    tenantId: UserTenantIdValueObject,
    externalId: UserExternalIdValueObject,
  ): Promise<UserAggregate | null> {
    this.logger.debug(
      `Finding User by tenantId ${tenantId.value} externalId ${externalId.value}`,
    );
    const entity = await this.repository.findOne({
      where: { tenantId: tenantId.value, externalId: externalId.value },
    });
    return entity ? this.mapper.toAggregate(entity) : null;
  }

  async findByCriteria(
    _criteria: Criteria,
  ): Promise<PaginatedResult<UserAggregate>> {
    // criteria-based pagination is a read-side concern — see
    // UserTypeOrmReadRepository.findByCriteria()
    throw new Error('Method not implemented.');
  }

  async save(aggregate: UserAggregate): Promise<UserAggregate> {
    this.logger.debug(`Saving User ${aggregate.id.value}`);
    const entity = this.mapper.toPersistence(aggregate);
    const saved = await this.repository.save(entity);
    return this.mapper.toAggregate(saved);
  }

  async delete(id: string): Promise<void> {
    this.logger.debug(`Deleting User ${id}`);
    await this.repository.delete(id);
  }
}
