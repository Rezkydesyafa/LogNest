import { registerDecorator, ValidationOptions } from 'class-validator';
import { isValidTimeZone } from '../../../../../packages/shared/src';

/** Accepts any IANA zone the runtime knows, so the list stays current without a lookup table. */
export function IsTimeZone(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isTimeZone',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a valid IANA timezone, for example Asia/Jakarta`,
        ...options,
      },
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isValidTimeZone(value),
      },
    });
  };
}
