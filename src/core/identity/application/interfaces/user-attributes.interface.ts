import { Role } from '../../domain/enums/role.enum';

/**
 * Payload for provider-delegated user creation/updates. Adapters translate
 * this into whatever shape their provider's admin API expects — nothing is
 * persisted locally.
 */
export interface IUserAttributes {
  email: string;
  emailVerified?: boolean;
  roles?: Role[];
  metadata?: Record<string, string>;
}
