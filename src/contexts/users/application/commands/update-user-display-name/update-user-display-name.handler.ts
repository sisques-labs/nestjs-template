import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { UpdateUserDisplayNameCommand } from '@contexts/users/application/commands/update-user-display-name/update-user-display-name.command';
import { FindOrCreateUserByExternalIdService } from '@contexts/users/application/services/write/find-or-create-user-by-external-id.service';
import { UserAggregate } from '@contexts/users/domain/aggregates/user.aggregate';
import {
  IUserWriteRepository,
  USER_WRITE_REPOSITORY,
} from '@contexts/users/domain/repositories/write/user-write.repository';
import { UserViewModel } from '@contexts/users/domain/view-models/user.view-model';

/**
 * Finds or creates the `User` (same as `UpsertUserFromClaimHandler`),
 * publishes its creation event if it was newly created, then applies the
 * requested `displayName` change and persists it. Needs
 * `IUserWriteRepository` directly (not just the find-or-create service) for
 * this second, rename-specific save.
 */
@CommandHandler(UpdateUserDisplayNameCommand)
@Injectable()
export class UpdateUserDisplayNameHandler
  extends BaseCommandHandler<UpdateUserDisplayNameCommand, UserAggregate>
  implements ICommandHandler<UpdateUserDisplayNameCommand, UserViewModel>
{
  private readonly logger = new Logger(UpdateUserDisplayNameHandler.name);

  constructor(
    eventBus: EventBus,
    private readonly findOrCreateUserByExternalIdService: FindOrCreateUserByExternalIdService,
    @Inject(USER_WRITE_REPOSITORY)
    private readonly userWriteRepository: IUserWriteRepository,
  ) {
    super(eventBus);
  }

  async execute(command: UpdateUserDisplayNameCommand): Promise<UserViewModel> {
    const user = await this.findOrCreateUserByExternalIdService.execute(
      command.tenantId,
      command.externalId,
      command.email,
    );
    const wasCreated = user.getUncommittedEvents().length > 0;

    if (wasCreated) {
      await this.publishEvents(user);
    }

    user.rename(command.displayName);
    await this.userWriteRepository.save(user);

    this.logger.log(
      `User ${user.id.value} displayName updated (tenantId="${command.tenantId.value}")`,
    );

    return new UserViewModel(user.toPrimitives());
  }
}
