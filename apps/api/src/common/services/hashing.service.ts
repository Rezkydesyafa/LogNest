import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

@Injectable()
export class HashingService {
  async hashPassword(password: string) {
    const salt = randomBytes(16).toString('base64url');
    const key = (await scryptAsync(password, salt, 64)) as Buffer;

    return `scrypt$v1$${salt}$${key.toString('base64url')}`;
  }

  async verifyPassword(password: string, storedHash: string) {
    const [, version, salt, hash] = storedHash.split('$');

    if (version !== 'v1' || !salt || !hash) {
      return false;
    }

    const expected = Buffer.from(hash, 'base64url');
    const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;

    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  hashApiKey(rawKey: string) {
    return createHash('sha256').update(rawKey).digest('hex');
  }
}
