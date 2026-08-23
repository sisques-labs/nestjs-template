import { BaseViewModel } from '@sisques-labs/nestjs-kit';
import { UserPrimitives } from '@contexts/users/domain/primitives/user.primitives';

/**
 * Read-side projection of a `User`, returned by `IUserReadRepository` and
 * by the `upsert`/`update-display-name` command handlers (see
 * `openspec/changes/add-users-context/design.md` — both `/users/me` verbs
 * need the current profile, not just an id). Constructed from a single
 * `UserPrimitives` params object, the established serialized shape for
 * this aggregate, rather than positional arguments.
 */
export class UserViewModel extends BaseViewModel {
  private readonly _tenantId: string;
  private readonly _externalId: string;
  private readonly _email: string | null;
  private readonly _displayName: string;
  private readonly _avatarUrl: string | null;

  constructor(primitives: UserPrimitives) {
    super(primitives.id, primitives.createdAt, primitives.updatedAt);
    this._tenantId = primitives.tenantId;
    this._externalId = primitives.externalId;
    this._email = primitives.email;
    this._displayName = primitives.displayName;
    this._avatarUrl = primitives.avatarUrl;
  }

  get tenantId(): string {
    return this._tenantId;
  }

  get externalId(): string {
    return this._externalId;
  }

  get email(): string | null {
    return this._email;
  }

  get displayName(): string {
    return this._displayName;
  }

  get avatarUrl(): string | null {
    return this._avatarUrl;
  }
}
