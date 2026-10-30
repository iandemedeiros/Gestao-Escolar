import { execFileSync } from 'node:child_process';
import { verify } from 'argon2';

describe('Local hash utility', () => {
  it('reads stdin and outputs only a valid Argon2id hash', async () => {
    const password = 'Fictional-password-only';
    const output = execFileSync(
      process.execPath,
      ['scripts/hash-password.mjs'],
      {
        input: password + '\n',
        encoding: 'utf8',
      },
    ).trim();
    expect(output.startsWith('$argon2id$')).toBe(true);
    expect(output.includes(password)).toBe(false);
    expect(await verify(output, password)).toBe(true);
  });
});
