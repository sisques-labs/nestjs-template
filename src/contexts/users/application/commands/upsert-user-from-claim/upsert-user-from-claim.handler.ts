import { Injectable, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { UpsertUserFromClaimCommand } from '@contexts/users/application/commands/upsert-user-from-claim/upsert-user-from-claim.command';
import { FindOrCreateUserByExternalIdService } from '@contexts/users/application/services/write/find-or-create-user-by-external-id.service';
import { UserAggregate } from '@contexts/users/domain/aggregates/user.aggregate';
import { UserViewModel } from '@contexts/users/domain/view-models/user.view-model';

/**
 * Delegates the find-or-create-and-resync logic to
 * `FindOrCreateUserByExternalIdService` and handles only what a command
 * handler is responsible for: publishing the resolved aggregate's events
 * (only present when it was newly created) and logging.
 */
@CommandHandler(UpsertUserFromClaimCommand)
@Injectable()
export class UpsertUserFromClaimHandler
  extends BaseCommandHandler<UpsertUserFromClaimCommand, UserAggregate>
  implements ICommandHandler<UpsertUserFromClaimCommand, UserViewModel>
{
  private readonly logger = new Logger(UpsertUserFromClaimHandler.name);

  constructor(
    eventBus: EventBus,
    private readonly findOrCreateUserByExternalIdService: FindOrCreateUserByExternalIdService,
  ) {
    super(eventBus);
  }

  async execute(command: UpsertUserFromClaimCommand): Promise<UserViewModel> {
    const user = await this.findOrCreateUserByExternalIdService.execute(
      command.tenantId,
      command.externalId,
      command.email,
    );
    const wasCreated = user.getUncommittedEvents().length > 0;

    if (wasCreated) {
      await this.publishEvents(user);
    }

    this.logger.log(
      `User resolved for tenantId "${command.tenantId.value}" externalId "${command.externalId.value}" (${wasCreated ? 'created' : 'found'}, id=${user.id.value})`,
    );

    return new UserViewModel(user.toPrimitives());
  }
}
