import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { UpsertTenantFromClaimCommand } from '@contexts/tenant/application/commands/upsert-tenant-from-claim/upsert-tenant-from-claim.command';
import { TenantAggregate } from '@contexts/tenant/domain/aggregates/tenant.aggregate';
import { TenantBuilder } from '@contexts/tenant/domain/builders/tenant.builder';
import {
  ITenantWriteRepository,
  TENANT_WRITE_REPOSITORY,
} from '@contexts/tenant/domain/repositories/write/tenant-write.repository';

/**
 * Find-or-create by `externalId`. No write when a `Tenant` already exists
 * for it — the unique index on `tenants.external_id` is the primary
 * defense against duplicates (see `add-tenant-context` design), this
 * lookup just avoids an unnecessary insert attempt on the common path
 * (every request after a tenant's first).
 *
 * Returns the resolved internal `Tenant.id` — unusual for a command
 * handler in this codebase, but required so the caller (`TenantGuard`, in
 * a later layer) can seed request-scoped tenant context synchronously,
 * within the same request, without a second `QueryBus` round trip.
 */
@CommandHandler(UpsertTenantFromClaimCommand)
@Injectable()
export class UpsertTenantFromClaimHandler
  extends BaseCommandHandler<UpsertTenantFromClaimCommand, TenantAggregate>
  implements ICommandHandler<UpsertTenantFromClaimCommand, string>
{
  private readonly logger = new Logger(UpsertTenantFromClaimHandler.name);

  constructor(
    eventBus: EventBus,
    @Inject(TENANT_WRITE_REPOSITORY)
    private readonly tenantWriteRepository: ITenantWriteRepository,
  ) {
    super(eventBus);
  }

  async execute(command: UpsertTenantFromClaimCommand): Promise<string> {
    const existing = await this.tenantWriteRepository.findByExternalId(
      command.externalId,
    );

    if (existing) {
      this.logger.log(
        `Tenant resolved for externalId "${command.externalId.value}" (found, id=${existing.id.value})`,
      );
      return existing.id.value;
    }

    const tenant = new TenantBuilder()
      .withId(UuidValueObject.generate().value)
      .withExternalId(command.externalId.value)
      .withCreatedAt(new Date())
      .withUpdatedAt(new Date())
      .build();

    tenant.create();

    await this.tenantWriteRepository.save(tenant);
    await this.publishEvents(tenant);

    this.logger.log(
      `Tenant resolved for externalId "${command.externalId.value}" (created, id=${tenant.id.value})`,
    );

    return tenant.id.value;
  }
}
