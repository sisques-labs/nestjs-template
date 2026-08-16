import { Injectable, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { UpsertTenantFromClaimCommand } from '@contexts/tenant/application/commands/upsert-tenant-from-claim/upsert-tenant-from-claim.command';
import { FindOrCreateTenantByExternalIdService } from '@contexts/tenant/application/services/write/find-or-create-tenant-by-external-id.service';
import { TenantAggregate } from '@contexts/tenant/domain/aggregates/tenant.aggregate';

/**
 * Delegates the find-or-create logic to `FindOrCreateTenantByExternalIdService`
 * and handles only what a command handler is responsible for: publishing
 * the resolved aggregate's events (only present when it was newly created —
 * a hydrated/found aggregate never had `create()` called on it, so it has
 * none) and logging.
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
    private readonly findOrCreateTenantByExternalIdService: FindOrCreateTenantByExternalIdService,
  ) {
    super(eventBus);
  }

  async execute(command: UpsertTenantFromClaimCommand): Promise<string> {
    const tenant = await this.findOrCreateTenantByExternalIdService.execute(
      command.externalId,
    );
    const wasCreated = tenant.getUncommittedEvents().length > 0;

    if (wasCreated) {
      await this.publishEvents(tenant);
    }

    this.logger.log(
      `Tenant resolved for externalId "${command.externalId.value}" (${wasCreated ? 'created' : 'found'}, id=${tenant.id.value})`,
    );

    return tenant.id.value;
  }
}
