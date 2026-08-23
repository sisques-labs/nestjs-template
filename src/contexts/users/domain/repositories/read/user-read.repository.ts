import { IBaseReadRepository } from '@sisques-labs/nestjs-kit';
import { UserViewModel } from '@contexts/users/domain/view-models/user.view-model';

/**
 * Read-side port for `User`. Implemented by
 * `infrastructure/persistence/typeorm/repositories/user-typeorm-read.repository.ts`.
 *
 * A type alias rather than an `interface extends {}` — `User` needs no read
 * methods beyond the base contract in v1 (no by-id lookup surface; see
 * `openspec/changes/add-users-context/proposal.md`, "Out of scope"), and an
 * empty-bodied interface extension is rejected by
 * `@typescript-eslint/no-empty-object-type`.
 */
export type IUserReadRepository = IBaseReadRepository<UserViewModel>;

/** DI token for `IUserReadRepository`. */
export const USER_READ_REPOSITORY = Symbol('USER_READ_REPOSITORY');
