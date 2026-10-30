import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { hash, argon2id } from 'argon2';
import { SignJWT } from 'jose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainsClient } from '../src/auth/domains.client.js';
import { JwtTokens } from '../src/auth/security.js';
const id = '123e4567-e89b-42d3-a456-426614174000';
const secret = 'fictional-jwt-key-for-tests-only-at-least-32-bytes';
const password = 'Fictional-password-only';
let encoded: string;
let app: INestApplication;
const domains = { verify: vi.fn(), change: vi.fn() };
beforeAll(async () => {
  encoded = await hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
});
beforeEach(async () => {
  vi.stubEnv('JWT_SECRET', secret);
  vi.stubEnv('SUPER_ADMIN_USERNAME', 'fixture-admin');
  vi.stubEnv('SUPER_ADMIN_PASSWORD_HASH', encoded);
  domains.verify.mockReset().mockResolvedValue(null);
  domains.change
    .mockReset()
    .mockResolvedValue({ message: 'Senha atualizada.' });
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DomainsClient)
    .useValue(domains)
    .compile();
  app = module.createNestApplication();
  await app.init();
});
afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
});
describe('Gateway authentication with simulated domains', () => {
  it('authenticates backend Super Admin without calling databases', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usuario: 'fixture-admin', senha: password })
      .expect(200);
    expect(response.body.user).toEqual({
      sub: 'super-admin',
      role: 'SUPER_ADMIN',
    });
    expect(response.body.expires_in).toBe(900);
    expect(
      await new JwtTokens().verify('Bearer ' + response.body.access_token),
    ).toEqual(response.body.user);
    expect(domains.verify).not.toHaveBeenCalled();
    expect(response.text).not.toContain('senha_hash');
    expect(response.text).not.toContain(encoded);
  });
  it.each(['ALUNO', 'PROFESSOR'] as const)(
    'derives %s role from the credential domain',
    async (role) => {
      domains.verify.mockImplementation(async (domain) =>
        domain === (role === 'ALUNO' ? 'alunos' : 'professores')
          ? { sub: id, role }
          : null,
      );
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ cpf: '111.111.111-11', senha: password })
        .expect(200);
      expect(response.body.user).toEqual({ sub: id, role });
      expect(domains.verify).toHaveBeenCalledWith(
        'alunos',
        '11111111111',
        password,
      );
      expect(domains.verify).toHaveBeenCalledWith(
        'professores',
        '11111111111',
        password,
      );
    },
  );
  it.each([
    { usuario: 'fixture-admin', senha: 'wrong' },
    { usuario: 'unknown', senha: password },
    { cpf: '11111111111', senha: password },
  ])('returns the same generic 401 for incorrect credentials', async (body) => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send(body)
      .expect(401);
    expect(response.body.message).toBe('Credenciais invalidas.');
  });
  it('does not let users select a role or submit arbitrary IDs', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        cpf: '11111111111',
        senha: password,
        role: 'SUPER_ADMIN',
        sub: 'super-admin',
      })
      .expect(400);
    expect(domains.verify).not.toHaveBeenCalled();
  });
  it('rejects ambiguous CPF/password matching both domains', async () => {
    domains.verify.mockImplementation(async (domain) => ({
      sub: id,
      role: domain === 'alunos' ? 'ALUNO' : 'PROFESSOR',
    }));
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ cpf: '11111111111', senha: password })
      .expect(401);
  });
  it('sanitizes unavailable domains and does not issue a partial login', async () => {
    domains.verify.mockRejectedValue(new Error('private driver details'));
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ cpf: '11111111111', senha: password })
      .expect(503);
    expect(response.text).not.toContain('private');
  });
  it.each([undefined, 'Bearer invalid'])(
    'rejects missing/invalid JWT at me',
    async (authorization) => {
      const call = request(app.getHttpServer()).get('/auth/me');
      if (authorization) call.set('Authorization', authorization);
      await call.expect(401);
    },
  );
  it('rejects expired JWT', async () => {
    const signed = await new SignJWT({ role: 'ALUNO' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(id)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 100)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
      .setIssuer('gestao-escolar')
      .setAudience('gestao-escolar-api')
      .sign(new TextEncoder().encode(secret));
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer ' + signed)
      .expect(401);
  });
  it('returns only signed subject and role at me, ignoring forged role headers', async () => {
    const token = await new JwtTokens().sign({ sub: id, role: 'ALUNO' });
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer ' + token)
      .set('x-role', 'SUPER_ADMIN')
      .expect(200)
      .expect({ sub: id, role: 'ALUNO' });
  });
  it('forwards password change with the signed principal, never a body ID', async () => {
    const token = await new JwtTokens().sign({ sub: id, role: 'ALUNO' });
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', 'Bearer ' + token)
      .send({ senha_atual: password, nova_senha: 'simple-password' })
      .expect(200)
      .expect({ message: 'Senha atualizada.' });
    expect(domains.change).toHaveBeenCalledWith(
      { sub: id, role: 'ALUNO' },
      'Bearer ' + token,
      { senha_atual: password, nova_senha: 'simple-password' },
    );
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', 'Bearer ' + token)
      .send({
        id: 'other',
        senha_atual: password,
        nova_senha: 'simple-password',
      })
      .expect(400);
  });
  it('does not offer database password changes for Super Admin', async () => {
    const token = await new JwtTokens().sign({
      sub: 'super-admin',
      role: 'SUPER_ADMIN',
    });
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', 'Bearer ' + token)
      .send({ senha_atual: password, nova_senha: 'simple-password' })
      .expect(403);
    expect(domains.change).not.toHaveBeenCalled();
  });
  it('rate limits excessive attempts and ignores spoofed forwarded IPs', async () => {
    for (let i = 0; i < 10; i++)
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('x-forwarded-for', '192.0.2.' + i)
        .send({ cpf: '11111111111', senha: 'wrong' })
        .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ cpf: '11111111111', senha: 'wrong' })
      .expect(429);
  });
  it('preserves gateway health', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ service: 'api-gateway', status: 'ok' });
  });
});
