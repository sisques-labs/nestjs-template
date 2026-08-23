import {
  DateValueObject,
  EmailValueObject,
  TimezoneValueObject,
  UrlValueObject,
} from '@sisques-labs/nestjs-kit';
import { UserAggregate } from '@contexts/users/domain/aggregates/user.aggregate';
import { UserCreatedEvent } from '@contexts/users/domain/events/user-created/user-created.event';
import { IUser } from '@contexts/users/domain/interfaces/user.interface';
import { UserDisplayNameValueObject } from '@contexts/users/domain/value-objects/user-display-name/user-display-name.vo';
import { UserExternalIdValueObject } from '@contexts/users/domain/value-objects/user-external-id/user-external-id.vo';
import { UserIdValueObject } from '@contexts/users/domain/value-objects/user-id/user-id.vo';
import { UserLocaleValueObject } from '@contexts/users/domain/value-objects/user-locale/user-locale.vo';
import { UserTenantIdValueObject } from '@contexts/users/domain/value-objects/user-tenant-id/user-tenant-id.vo';

const VALID_UUID = '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11';
const VALID_TENANT_UUID = '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a12';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const UPDATED_AT = new Date('2026-01-01T00:00:00.000Z');

function buildUser(overrides: Partial<IUser> = {}): IUser {
  return {
    id: new UserIdValueObject(VALID_UUID),
    tenantId: new UserTenantIdValueObject(VALID_TENANT_UUID),
    externalId: new UserExternalIdValueObject('sub-42'),
    email: new EmailValueObject('alice@example.com'),
    displayName: new UserDisplayNameValueObject('Alice'),
    avatarUrl: new UrlValueObject('https://example.com/avatar.png'),
    locale: new UserLocaleValueObject('en-US'),
    timezone: new TimezoneValueObject('America/New_York', {
      validateExistence: false,
    }),
    createdAt: new DateValueObject(CREATED_AT),
    updatedAt: new DateValueObject(UPDATED_AT),
    ...overrides,
  };
}

describe('UserAggregate', () => {
  describe('constructor', () => {
    it('hydrates fields from an already-VO-wrapped IUser without emitting any events', () => {
      const user = new UserAggregate(buildUser());

      expect(user.id.value).toBe(VALID_UUID);
      expect(user.tenantId.value).toBe(VALID_TENANT_UUID);
      expect(user.externalId.value).toBe('sub-42');
      expect(user.email?.value).toBe('alice@example.com');
      expect(user.displayName.value).toBe('Alice');
      expect(user.avatarUrl?.value).toBe('https://example.com/avatar.png');
      expect(user.locale?.value).toBe('en-US');
      expect(user.timezone?.value).toBe('America/New_York');
      expect(user.toPrimitives()).toEqual({
        id: VALID_UUID,
        tenantId: VALID_TENANT_UUID,
        externalId: 'sub-42',
        email: 'alice@example.com',
        displayName: 'Alice',
        avatarUrl: 'https://example.com/avatar.png',
        locale: 'en-US',
        timezone: 'America/New_York',
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      });
      expect(user.getUncommittedEvents()).toHaveLength(0);
    });

    it('hydrates a null email', () => {
      const user = new UserAggregate(buildUser({ email: null }));

      expect(user.email).toBeNull();
      expect(user.toPrimitives().email).toBeNull();
    });

    it('hydrates a null avatarUrl', () => {
      const user = new UserAggregate(buildUser({ avatarUrl: null }));

      expect(user.avatarUrl).toBeNull();
      expect(user.toPrimitives().avatarUrl).toBeNull();
    });

    it('hydrates a null locale', () => {
      const user = new UserAggregate(buildUser({ locale: null }));

      expect(user.locale).toBeNull();
      expect(user.toPrimitives().locale).toBeNull();
    });

    it('hydrates a null timezone', () => {
      const user = new UserAggregate(buildUser({ timezone: null }));

      expect(user.timezone).toBeNull();
      expect(user.toPrimitives().timezone).toBeNull();
    });

    it('rejects an invalid id', () => {
      expect(
        () =>
          new UserAggregate(
            buildUser({ id: new UserIdValueObject('not-a-uuid') }),
          ),
      ).toThrow();
    });

    it('rejects an empty externalId', () => {
      expect(
        () =>
          new UserAggregate(
            buildUser({ externalId: new UserExternalIdValueObject('') }),
          ),
      ).toThrow();
    });
  });

  describe('create', () => {
    it('emits a single UserCreatedEvent carrying the aggregate primitives', () => {
      const user = new UserAggregate(buildUser());

      user.create();

      const events = user.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(UserCreatedEvent);
      expect((events[0] as UserCreatedEvent).data).toEqual(user.toPrimitives());
    });
  });

  describe('rename', () => {
    it('updates displayName without emitting an event', () => {
      const user = new UserAggregate(buildUser());

      user.rename(new UserDisplayNameValueObject('Alicia'));

      expect(user.displayName.value).toBe('Alicia');
      expect(user.getUncommittedEvents()).toHaveLength(0);
    });

    it('bumps updatedAt', () => {
      const user = new UserAggregate(buildUser());
      const before = user.updatedAt.value;

      user.rename(new UserDisplayNameValueObject('Alicia'));

      expect(user.updatedAt.value.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });
  });

  describe('syncEmail', () => {
    it('updates email without emitting an event', () => {
      const user = new UserAggregate(buildUser());

      user.syncEmail(new EmailValueObject('new@example.com'));

      expect(user.email?.value).toBe('new@example.com');
      expect(user.getUncommittedEvents()).toHaveLength(0);
    });

    it('accepts null, clearing a previously set email', () => {
      const user = new UserAggregate(buildUser());

      user.syncEmail(null);

      expect(user.email).toBeNull();
    });
  });

  describe('updateAvatarUrl', () => {
    it('updates avatarUrl without emitting an event', () => {
      const user = new UserAggregate(buildUser());

      user.updateAvatarUrl(new UrlValueObject('https://example.com/new.png'));

      expect(user.avatarUrl?.value).toBe('https://example.com/new.png');
      expect(user.getUncommittedEvents()).toHaveLength(0);
    });

    it('accepts null, clearing a previously set avatarUrl', () => {
      const user = new UserAggregate(buildUser());

      user.updateAvatarUrl(null);

      expect(user.avatarUrl).toBeNull();
    });

    it('bumps updatedAt', () => {
      const user = new UserAggregate(buildUser());
      const before = user.updatedAt.value;

      user.updateAvatarUrl(new UrlValueObject('https://example.com/new.png'));

      expect(user.updatedAt.value.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });
  });

  describe('updateLocale', () => {
    it('updates locale without emitting an event', () => {
      const user = new UserAggregate(buildUser());

      user.updateLocale(new UserLocaleValueObject('es-ES'));

      expect(user.locale?.value).toBe('es-ES');
      expect(user.getUncommittedEvents()).toHaveLength(0);
    });

    it('accepts null, clearing a previously set locale', () => {
      const user = new UserAggregate(buildUser());

      user.updateLocale(null);

      expect(user.locale).toBeNull();
    });

    it('bumps updatedAt', () => {
      const user = new UserAggregate(buildUser());
      const before = user.updatedAt.value;

      user.updateLocale(new UserLocaleValueObject('es-ES'));

      expect(user.updatedAt.value.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });
  });

  describe('updateTimezone', () => {
    it('updates timezone without emitting an event', () => {
      const user = new UserAggregate(buildUser());

      user.updateTimezone(
        new TimezoneValueObject('Europe/Madrid', { validateExistence: false }),
      );

      expect(user.timezone?.value).toBe('Europe/Madrid');
      expect(user.getUncommittedEvents()).toHaveLength(0);
    });

    it('accepts null, clearing a previously set timezone', () => {
      const user = new UserAggregate(buildUser());

      user.updateTimezone(null);

      expect(user.timezone).toBeNull();
    });

    it('bumps updatedAt', () => {
      const user = new UserAggregate(buildUser());
      const before = user.updatedAt.value;

      user.updateTimezone(
        new TimezoneValueObject('Europe/Madrid', { validateExistence: false }),
      );

      expect(user.updatedAt.value.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });
  });
});
