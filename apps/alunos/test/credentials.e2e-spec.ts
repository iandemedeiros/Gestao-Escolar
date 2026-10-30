import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { hash, verify, argon2id } from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JwtTokens } from '../src/auth/security.js';
const id = '123e4567-e89b-42d3-a456-426614174000';
const secret = 'fictional-internal-token-for-tests-at-least-32-bytes';
const password = 'Fictional-password-only';
let encoded: string;
let app: INestApplication;
const findUnique = vi.fn(),
  updateMany = vi.fn();
beforeAll(async () => {
  encoded = await hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
});
beforeEach(async () => {
  vi.stubEnv(
    'JWT_SECRET',
    'fictional-jwt-key-for-tests-only-at-least-32-bytes',
  );
  vi.stubEnv('INTERNAL_AUTH_TOKEN', secret);
  findUnique
    .mockReset()
    .mockResolvedValue({ id, senha_hash: encoded, admin: true });
  updateMany.mockReset().mockResolvedValue({ count: 1 });
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({ client: { aluno: { findUnique, updateMany } } })
    .compile();
  app = module.createNestApplication();
  await app.init();
});
afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
});
describe('alunos protected credential endpoints with fake Prisma', () => {
  it('rejects direct frontend access, even with a valid user JWT', async () => {
    const token = await new JwtTokens().sign({ sub: id, role: 'ALUNO' });
    await request(app.getHttpServer())
      .post('/internal/auth/verify')
      .set('Authorization', 'Bearer ' + token)
      .send({ cpf: '11111111111', senha: password })
      .expect(401);
    expect(findUnique).not.toHaveBeenCalled();
  });
  it('rejects a wrong internal secret', async () => {
    await request(app.getHttpServer())
      .post('/internal/auth/verify')
      .set('x-internal-auth-token', 'incorrect')
      .send({ cpf: '11111111111', senha: password })
      .expect(401);
    expect(findUnique).not.toHaveBeenCalled();
  });
  it('normalizes local CPF and derives the role without exposing hash/admin', async () => {
    const response = await request(app.getHttpServer())
      .post('/internal/auth/verify')
      .set('x-internal-auth-token', secret)
      .send({ cpf: '111.111.111-11', senha: password })
      .expect(200);
    expect(response.body).toEqual({ sub: id, role: 'ALUNO' });
    expect(findUnique).toHaveBeenCalledWith({
      where: { cpf: '11111111111' },
      select: { id: true, senha_hash: true },
    });
    expect(response.text).not.toContain(encoded);
    expect(response.text).not.toContain('senha_hash');
    expect(response.text).not.toContain('admin');
  });
  it('uses the same generic error for a missing CPF', async () => {
    findUnique.mockResolvedValue(null);
    const response = await request(app.getHttpServer())
      .post('/internal/auth/verify')
      .set('x-internal-auth-token', secret)
      .send({ cpf: '11111111111', senha: password })
      .expect(401);
    expect(response.body.message).toBe('Credenciais invalidas.');
  });
  it('uses the same generic error for wrong passwords and corrupt stored hashes', async () => {
    const response = await request(app.getHttpServer())
      .post('/internal/auth/verify')
      .set('x-internal-auth-token', secret)
      .send({ cpf: '11111111111', senha: 'wrong' })
      .expect(401);
    expect(response.body.message).toBe('Credenciais invalidas.');
    findUnique.mockResolvedValue({ id, senha_hash: 'corrupt' });
    await request(app.getHttpServer())
      .post('/internal/auth/verify')
      .set('x-internal-auth-token', secret)
      .send({ cpf: '11111111111', senha: 'wrong' })
      .expect(401);
  });
  it('rejects invalid CPF and role selection without querying', async () => {
    await request(app.getHttpServer())
      .post('/internal/auth/verify')
      .set('x-internal-auth-token', secret)
      .send({ cpf: 'bad', senha: password })
      .expect(400);
    await request(app.getHttpServer())
      .post('/internal/auth/verify')
      .set('x-internal-auth-token', secret)
      .send({ cpf: '11111111111', senha: password, role: 'SUPER_ADMIN' })
      .expect(400);
    expect(findUnique).not.toHaveBeenCalled();
  });
  it('sanitizes database failures', async () => {
    findUnique.mockRejectedValue(new Error('private database details'));
    const response = await request(app.getHttpServer())
      .post('/internal/auth/verify')
      .set('x-internal-auth-token', secret)
      .send({ cpf: '11111111111', senha: password })
      .expect(503);
    expect(response.text).not.toContain('private');
  });
  it('changes only the signed subject password using a hash and optimistic match', async () => {
    const token = await new JwtTokens().sign({ sub: id, role: 'ALUNO' });
    const response = await request(app.getHttpServer())
      .post('/internal/auth/change-password')
      .set('x-internal-auth-token', secret)
      .set('Authorization', 'Bearer ' + token)
      .send({ senha_atual: password, nova_senha: 'simple-password' })
      .expect(200);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id },
      select: { id: true, senha_hash: true },
    });
    const args = updateMany.mock.calls[0][0];
    expect(args.where).toEqual({ id, senha_hash: encoded });
    expect(Object.keys(args.data)).toEqual(['senha_hash']);
    expect(await verify(args.data.senha_hash, 'simple-password')).toBe(true);
    expect(response.body).toEqual({ message: 'Senha atualizada.' });
  });
  it('does not write on incorrect current password or spoofed subject', async () => {
    const token = await new JwtTokens().sign({ sub: id, role: 'ALUNO' });
    await request(app.getHttpServer())
      .post('/internal/auth/change-password')
      .set('x-internal-auth-token', secret)
      .set('Authorization', 'Bearer ' + token)
      .send({ senha_atual: 'wrong', nova_senha: 'simple-password' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/internal/auth/change-password')
      .set('x-internal-auth-token', secret)
      .set('Authorization', 'Bearer ' + token)
      .send({
        senha_atual: password,
        nova_senha: 'simple-password',
        id: 'other',
      })
      .expect(400);
    expect(updateMany).not.toHaveBeenCalled();
  });
  it('requires JWT and the correct domain role for password changes', async () => {
    await request(app.getHttpServer())
      .post('/internal/auth/change-password')
      .set('x-internal-auth-token', secret)
      .send({})
      .expect(401);
    const token = await new JwtTokens().sign({ sub: id, role: 'PROFESSOR' });
    await request(app.getHttpServer())
      .post('/internal/auth/change-password')
      .set('x-internal-auth-token', secret)
      .set('Authorization', 'Bearer ' + token)
      .send({})
      .expect(403);
    expect(findUnique).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
  it('detects a concurrent password change', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    const token = await new JwtTokens().sign({ sub: id, role: 'ALUNO' });
    await request(app.getHttpServer())
      .post('/internal/auth/change-password')
      .set('x-internal-auth-token', secret)
      .set('Authorization', 'Bearer ' + token)
      .send({ senha_atual: password, nova_senha: 'simple-password' })
      .expect(409);
  });
  it('rate limits the internal verification endpoint too', async () => {
    for (let i = 0; i < 10; i++)
      await request(app.getHttpServer())
        .post('/internal/auth/verify')
        .set('x-internal-auth-token', secret)
        .send({})
        .expect(400);
    await request(app.getHttpServer())
      .post('/internal/auth/verify')
      .set('x-internal-auth-token', secret)
      .send({})
      .expect(429);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
