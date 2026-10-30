import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JwtTokens, type Role } from '../src/auth/security.js';
import { createPrismaMock } from './support/crud-fixtures.js';
import { PasswordHasher } from '../src/common/password-hasher.service.js';
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
  for (const delegate of [
    prisma.client.professor,
    prisma.client.contato,
    prisma.client.disponibilidade_horario,
  ])
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
    path: 'professores',
    id: '123e4567-e89b-42d3-a456-426614174000',
    sample: {
      nome: 'Professor ficticio',
      cpf: '52998224725',
      email: 'professor@example.invalid',
      senha: 'Fictional-password-123!',
    },
    patch: { nome: 'Nome alterado' },
    noDetail: false,
  },
  {
    path: 'contatos',
    id: '123e4567-e89b-42d3-a456-426614174000',
    sample: {
      professor_id: '123e4567-e89b-42d3-a456-426614174010',
      telefone: '12345678',
    },
    patch: { celular: '123456789' },
    noDetail: false,
  },
  {
    path: 'disponibilidades',
    id: '123e4567-e89b-42d3-a456-426614174000',
    sample: {
      professor_id: '123e4567-e89b-42d3-a456-426614174010',
      dia_semana: 'segunda',
      hora_inicio: '08:00:00',
      hora_fim: '10:00:00',
    },
    patch: { hora_fim: '11:00:00' },
    noDetail: false,
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
          .expect(403);
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

it('lets a professor read only their own basic cadastro', async () => {
  const authorization = await bearer('PROFESSOR', id);
  const response = await request(app.getHttpServer())
    .get('/professores/' + id)
    .set('Authorization', authorization)
    .expect(200);
  expect(Object.keys(response.body).sort()).toEqual(
    ['id', 'nome', 'formacao'].sort(),
  );
  await request(app.getHttpServer())
    .get('/professores/' + other)
    .set('Authorization', authorization)
    .expect(403);
  expect(prisma.client.professor.findUnique).toHaveBeenCalledOnce();
});
it('does not let professors change their admin flag or create alunos', async () => {
  await request(app.getHttpServer())
    .patch('/professores/' + id)
    .set('Authorization', await bearer('PROFESSOR', id))
    .send({ admin: true })
    .expect(403);
  noDatabaseCalls();
});
