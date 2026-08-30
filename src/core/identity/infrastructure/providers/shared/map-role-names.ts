import { Role } from '@core/identity/domain/enums/role.enum';

const ROLE_VALUES = new Set<string>(Object.values(Role));

/**
 * Maps raw role/group names from a provider's claims onto the shared `Role`
 * enum, case-insensitively, silently dropping names that don't match a
 * known role. Shared by every `*-claims.mapper.ts` so the matching rule
 * only lives in one place.
 */
export function mapRoleNames(names: readonly string[] | undefined): Role[] {
  if (!names) {
    return [];
  }

  const roles: Role[] = [];
  for (const name of names) {
    const normalized = name.toLowerCase();
    if (ROLE_VALUES.has(normalized)) {
      roles.push(normalized as Role);
    }
  }
  return roles;
}
