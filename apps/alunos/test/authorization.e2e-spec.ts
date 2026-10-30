import { AcademicHttp } from '../src/academic/academic.http.js';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JwtTokens, type Role } from '../src/auth/security.js';
import { createPrismaMock } from './support/crud-fixtures.js';
import { PasswordHasher } from '../src/alunos/password-hasher.service.js';
let app: INestApplication;
let prisma: ReturnType<typeof createPrismaMock>;
const id = '123e4567-e89b-42d3-a456-426614174000',
  other = '123e4567-e89b-42d3-a456-426614174009';
beforeEach(async () => {
  vi.stubEnv(
    'JWT_SECRET',
    'fictional-jwt-key-for-tests-only-at-least-32-bytes',
  );
  prisma = createPrismaMock();
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(AcademicHttp)
    .useValue({
      scope: vi.fn().mockResolvedValue({ contexts: [], aluno_ids: [] }),
    })
    .overrideProvider(PasswordHasher)
    .useValue({
      hash: vi.fn().mockResolvedValue('$argon2id$test-placeholder'),
    });
  const module = await builder.compile();
  app = module.createNestApplication();
  await app.init();
});
afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
});
async function bearer(role: Role, sub = other) {
  return (
    'Bearer ' +
    (await new JwtTokens().sign({
      sub: role === 'SUPER_ADMIN' ? 'super-admin' : sub,
      role,
    }))
  );
}
function noDatabaseCalls() {
  for (const delegate of [prisma.client.aluno, prisma.client.contato])
    for (const method of Object.values(delegate))
      expect(method).not.toHaveBeenCalled();
  expect(prisma.client.$transaction).not.toHaveBeenCalled();
}
const administrative: Array<{
  path: string;
  id: string;
  sample: Record<string, unknown>;
  patch: Record<string, unknown>;
  noDetail: boolean;
}> = [
  {
    path: 'alunos',
    id: '123e4567-e89b-42d3-a456-426614174000',
    sample: {
      nome: 'Aluno ficticio',
      data_nascimento: '2000-01-02',
      cpf: '11111111111',
      email: 'aluno@example.invalid',
      senha: 'simple-password',
    },
    patch: { nome: 'Novo nome' },
    noDetail: false,
  },
  {
    path: 'alunos/123e4567-e89b-42d3-a456-426614174000/contatos',
    id: '123e4567-e89b-42d3-a456-426614174002',
    sample: { telefone: '12345678' },
    patch: { celular: '12345678' },
    noDetail: true,
  },
];
for (const resource of administrative) {
  const base = '/' + resource.path,
    detail = base + '/' + resource.id;
  const routes = [
    { method: 'get', path: base, body: undefined, status: 200 },
    ...(!resource.noDetail
      ? [{ method: 'get' as const, path: detail, body: undefined, status: 200 }]
      : []),
    { method: 'post', path: base, body: resource.sample, status: 201 },
    { method: 'patch', path: detail, body: resource.patch, status: 200 },
    { method: 'delete', path: detail, body: undefined, status: 204 },
  ] as const;
  for (const route of routes) {
    it('allows Super Admin ' + route.method + ' ' + route.path, async () => {
      await request(app.getHttpServer())
        [route.method](route.path)
        .set('Authorization', await bearer('SUPER_ADMIN'))
        .send(route.body)
        .expect(route.status);
    });
    it.each(['ALUNO', 'PROFESSOR'] as const)(
      'rejects %s on administrative ' + route.method + ' ' + route.path,
      async (role) => {
        await request(app.getHttpServer())
          [route.method](route.path)
          .set('Authorization', await bearer(role))
          .set('x-role', 'SUPER_ADMIN')
          .send(route.body)
          .expect(
            role === 'PROFESSOR' &&
              route.method === 'get' &&
              route.path === '/alunos'
              ? 200
              : 403,
          );
        if (!(
          role === 'PROFESSOR' &&
          route.method === 'get' &&
          route.path === '/alunos'
        ))
          noDatabaseCalls();
      },
    );
  }
}
const academic: Array<{ path: string; id: string }> = [];
for (const resource of academic) {
  const base = '/' + resource.path;
  for (const method of ['get', 'post', 'patch', 'delete'] as const) {
    it.each(['ALUNO', 'PROFESSOR', 'SUPER_ADMIN'] as const)(
      'keeps academic ' + method + ' blocked for %s',
      async (role) => {
        const path = ['patch', 'delete'].includes(method)
          ? base + '/' + resource.id
          : base;
        await request(app.getHttpServer())
          [method](path)
          .set('Authorization', await bearer(role))
          .send(method === 'post' || method === 'patch' ? {} : undefined)
          .expect(403);
        noDatabaseCalls();
      },
    );
  }
  it.each(['ALUNO', 'PROFESSOR', 'SUPER_ADMIN'] as const)(
    'keeps academic detail blocked for %s',
    async (role) => {
      await request(app.getHttpServer())
        .get(base + '/' + resource.id)
        .set('Authorization', await bearer(role))
        .expect(403);
      noDatabaseCalls();
    },
  );
}

it('lets an aluno read only their own cadastro', async () => {
  const authorization = await bearer('ALUNO', id);
  const response = await request(app.getHttpServer())
    .get('/alunos/' + id)
    .set('Authorization', authorization)
    .expect(200);
  expect(Object.keys(response.body).sort()).toEqual(
    ['id', 'nome', 'data_nascimento'].sort(),
  );
  await request(app.getHttpServer())
    .get('/alunos/' + other)
    .set('Authorization', authorization)
    .expect(403);
  expect(prisma.client.aluno.findUnique).toHaveBeenCalledOnce();
});
it('limits contact reads to the signed aluno ID', async () => {
  const authorization = await bearer('ALUNO', id);
  await request(app.getHttpServer())
    .get('/alunos/' + id + '/contatos')
    .set('Authorization', authorization)
    .expect(200);
  await request(app.getHttpServer())
    .get('/alunos/' + other + '/contatos')
    .set('Authorization', authorization)
    .expect(403);
  expect(prisma.client.contato.findMany).toHaveBeenCalledOnce();
});
it('rejects own-account mutations and self-registration for an aluno', async () => {
  const authorization = await bearer('ALUNO', id);
  await request(app.getHttpServer())
    .patch('/alunos/' + id)
    .set('Authorization', authorization)
    .send({ nome: 'Novo' })
    .expect(403);
  await request(app.getHttpServer())
    .delete('/alunos/' + id)
    .set('Authorization', authorization)
    .expect(403);
  await request(app.getHttpServer())
    .post('/alunos')
    .set('Authorization', authorization)
    .send({})
    .expect(403);
  noDatabaseCalls();
});
