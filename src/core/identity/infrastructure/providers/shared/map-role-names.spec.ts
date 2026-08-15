import { Role } from '../../../domain/enums/role.enum';
import { mapRoleNames } from './map-role-names';

describe('mapRoleNames', () => {
  it('returns an empty array when names is undefined', () => {
    expect(mapRoleNames(undefined)).toEqual([]);
  });

  it('maps known role names case-insensitively', () => {
    expect(mapRoleNames(['Admin', 'user'])).toEqual([Role.ADMIN, Role.USER]);
  });

  it('drops names that do not match a known role', () => {
    expect(mapRoleNames(['admin', 'super-duper', 'user'])).toEqual([
      Role.ADMIN,
      Role.USER,
    ]);
  });

  it('returns an empty array for an empty list', () => {
    expect(mapRoleNames([])).toEqual([]);
  });
});
