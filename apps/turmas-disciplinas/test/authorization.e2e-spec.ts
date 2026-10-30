import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JwtTokens, type Role } from '../src/auth/security.js';
import { createPrismaMock } from './support/crud-fixtures.js';
let app: INestApplication;
let prisma: ReturnType<typeof createPrismaMock>;
const other = '123e4567-e89b-42d3-a456-426614174009';
beforeEach(async () => {
  vi.stubEnv(
    'JWT_SECRET',
    'fictional-jwt-key-for-tests-only-at-least-32-bytes',
  );
  prisma = createPrismaMock();
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma);
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
    prisma.client.turma,
    prisma.client.disciplina,
    prisma.client.alocacao_aluno,
    prisma.client.alocacao_professor,
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
    path: 'turmas',
    id: '1',
    sample: {
      nome: 'Turma ficticia',
      ano_letivo: 2026,
      turno: 'matutino',
      capacidade_maxima: 30,
    },
    patch: { capacidade_maxima: 40 },
    noDetail: false,
  },
  {
    path: 'disciplinas',
    id: '123e4567-e89b-42d3-a456-426614174000',
    sample: { nome: 'Disciplina ficticia', carga_horaria: 60 },
    patch: { carga_horaria: 80 },
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
          .expect(route.method === 'get' ? 200 : 403);
        if (route.method !== 'get') noDatabaseCalls();
      },
    );
  }
}
