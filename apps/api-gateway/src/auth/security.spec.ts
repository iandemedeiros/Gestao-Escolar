import { SignJWT } from 'jose';
import { UnauthorizedException } from '@nestjs/common';
import { JwtTokens } from './security.js';
const secret = 'fictional-jwt-key-for-tests-only-at-least-32-bytes';
const id = '123e4567-e89b-42d3-a456-426614174000';
describe('JWT verification', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', secret);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it.each(['ALUNO', 'PROFESSOR', 'SUPER_ADMIN'] as const)(
    'signs and verifies %s',
    async (role) => {
      const tokens = new JwtTokens();
      const user = { sub: role === 'SUPER_ADMIN' ? 'super-admin' : id, role };
      expect(
        await tokens.verify('Bearer ' + (await tokens.sign(user))),
      ).toEqual(user);
    },
  );
  it.each([
    undefined,
    '',
    'invalid',
    'Bearer invalid',
    'Bearer a.b.c',
    'Bearer a b',
  ])('rejects absent/malformed token', async (token) => {
    await expect(new JwtTokens().verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
  it.each([
    'expired',
    'algorithm',
    'issuer',
    'audience',
    'role',
    'subject',
    'typ',
    'missing-exp',
  ])('rejects %s claims', async (kind) => {
    let token = new SignJWT({ role: kind === 'role' ? 'ADMIN' : 'ALUNO' })
      .setProtectedHeader({
        alg: kind === 'algorithm' ? 'HS384' : 'HS256',
        typ: kind === 'typ' ? 'other' : 'JWT',
      })
      .setSubject(kind === 'subject' ? 'super-admin' : id)
      .setIssuedAt()
      .setIssuer(kind === 'issuer' ? 'other' : 'gestao-escolar')
      .setAudience(kind === 'audience' ? 'other' : 'gestao-escolar-api');
    if (kind !== 'missing-exp')
      token = token.setExpirationTime(kind === 'expired' ? '0s' : '15m');
    const signed = await token.sign(new TextEncoder().encode(secret));
    await expect(
      new JwtTokens().verify('Bearer ' + signed),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('does not accept a token signed by another key', async () => {
    const tokens = new JwtTokens();
    const signed = await tokens.sign({ sub: id, role: 'ALUNO' });
    vi.stubEnv(
      'JWT_SECRET',
      'another-fictional-key-for-tests-at-least-32-bytes',
    );
    await expect(tokens.verify('Bearer ' + signed)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
