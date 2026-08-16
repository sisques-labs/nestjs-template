import { StringValueObject } from '@sisques-labs/nestjs-kit';

export class IdempotencyKeyValueObject extends StringValueObject {
  constructor(value: string) {
    super(value, { minLength: 1, allowEmpty: false, trim: true });
  }
}
