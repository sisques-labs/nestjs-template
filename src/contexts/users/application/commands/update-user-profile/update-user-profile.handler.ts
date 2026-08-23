import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { UpdateUserProfileCommand } from '@contexts/users/application/commands/update-user-profile/update-user-profile.command';
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
 * requested `displayName` change (always) and `avatarUrl`/`locale`/
 * `timezone` changes (only for each key where the command's own field
 * `!== undefined` — see the command's doc comment for the three-state
 * contract), persisting once all are applied. Needs
 * `IUserWriteRepository` directly (not just the find-or-create service) for
 * this second, profile-update-specific save.
 */
@CommandHandler(UpdateUserProfileCommand)
@Injectable()
export class UpdateUserProfileHandler
  extends BaseCommandHandler<UpdateUserProfileCommand, UserAggregate>
  implements ICommandHandler<UpdateUserProfileCommand, UserViewModel>
{
  private readonly logger = new Logger(UpdateUserProfileHandler.name);

  constructor(
    eventBus: EventBus,
    private readonly findOrCreateUserByExternalIdService: FindOrCreateUserByExternalIdService,
    @Inject(USER_WRITE_REPOSITORY)
    private readonly userWriteRepository: IUserWriteRepository,
  ) {
    super(eventBus);
  }

  async execute(command: UpdateUserProfileCommand): Promise<UserViewModel> {
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
    if (command.avatarUrl !== undefined) {
      user.updateAvatarUrl(command.avatarUrl);
    }
    if (command.locale !== undefined) {
      user.updateLocale(command.locale);
    }
    if (command.timezone !== undefined) {
      user.updateTimezone(command.timezone);
    }
    await this.userWriteRepository.save(user);

    this.logger.log(
      `User ${user.id.value} profile updated (tenantId="${command.tenantId.value}")`,
    );

    return new UserViewModel(user.toPrimitives());
  }
}
