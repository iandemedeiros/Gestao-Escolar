import { argon2id, verify } from 'argon2';
import { PasswordHasher } from './password-hasher.service.js';

describe('PasswordHasher offline', () => {
  it('creates salted Argon2id hashes with configured work factors', async () => {
    const service = new PasswordHasher();
    const password = 'Fictional-password-123!';
    const first = await service.hash(password);
    const second = await service.hash(password);
    expect(argon2id).toBe(2);
    expect(first.startsWith('$argon2id$v=19$')).toBe(true);
    expect(first.split('$')[3].split(',').sort()).toEqual([
      'm=19456',
      'p=1',
      't=2',
    ]);
    expect(first === second).toBe(false);
    expect(first.length).toBeLessThanOrEqual(255);
    expect(await verify(first, password)).toBe(true);
    expect(await verify(first, 'wrong-password')).toBe(false);
  });
});
