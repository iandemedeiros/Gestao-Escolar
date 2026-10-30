import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AccessGuard } from '../src/common/access.guard.js';
import { PasswordHasher } from '../src/common/password-hasher.service.js';
import { createPrismaMock, knownError } from './support/crud-fixtures.js';
const resources = [
  {
    path: 'professores',
    model: 'professor',
    id: '123e4567-e89b-42d3-a456-426614174000',
    sample: {
      nome: 'Professor ficticio',
      cpf: '52998224725',
      email: 'professor@example.invalid',
      senha: 'Fictional-password-123!',
    },
    patch: { nome: 'Nome alterado' },
    expected: {
      id: '123e4567-e89b-42d3-a456-426614174000',
      nome: 'Professor ficticio',
      formacao: null,
    },
  },
  {
    path: 'contatos',
    model: 'contato',
    id: '123e4567-e89b-42d3-a456-426614174000',
    sample: {
      professor_id: '123e4567-e89b-42d3-a456-426614174010',
      telefone: '12345678',
    },
    patch: { celular: '123456789' },
    expected: {
      id: '123e4567-e89b-42d3-a456-426614174000',
      professor_id: '123e4567-e89b-42d3-a456-426614174010',
    },
  },
  {
    path: 'disponibilidades',
    model: 'disponibilidade_horario',
    id: '123e4567-e89b-42d3-a456-426614174000',
    sample: {
      professor_id: '123e4567-e89b-42d3-a456-426614174010',
      dia_semana: 'segunda',
      hora_inicio: '08:00:00',
      hora_fim: '10:00:00',
    },
    patch: { hora_fim: '11:00:00' },
    expected: {
      id: '123e4567-e89b-42d3-a456-426614174000',
      professor_id: '123e4567-e89b-42d3-a456-426614174010',
      dia_semana: 'segunda',
      hora_inicio: '08:00:00',
      hora_fim: '10:00:00',
    },
  },
];
let app: INestApplication;
let prisma: ReturnType<typeof createPrismaMock>;
const passwords = { hash: vi.fn() };
async function setup(overrideGuard = false) {
  prisma = createPrismaMock();
  passwords.hash.mockReset().mockResolvedValue('$argon2id$test-placeholder');
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(PasswordHasher)
    .useValue(passwords);
  // The guard is overridden ONLY in this in-memory test app with fake Prisma.
  if (overrideGuard)
    builder.overrideGuard(AccessGuard).useValue({ canActivate: () => true });
  const module = await builder.compile();
  app = module.createNestApplication();
  await app.init();
}
function noDatabaseCalls() {
  for (const delegate of [
    prisma.client.professor,
    prisma.client.contato,
    prisma.client.disponibilidade_horario,
  ]) {
    for (const method of Object.values(delegate))
      expect(method).not.toHaveBeenCalled();
  }
  expect(prisma.client.$transaction).not.toHaveBeenCalled();
}
afterEach(async () => {
  await app?.close();
});
for (const resource of resources) {
  const base = '/' + resource.path;
  const detail = base + '/' + resource.id;
  const routes = [
    {
      method: 'get',
      path: base,
      body: undefined,
      status: 200,
      operation: 'findMany',
    },
    {
      method: 'get',
      path: detail,
      body: undefined,
      status: 200,
      operation: 'findUnique',
    },
    {
      method: 'post',
      path: base,
      body: resource.sample,
      status: 201,
      operation: 'create',
    },
    {
      method: 'patch',
      path: detail,
      body: resource.patch,
      status: 200,
      operation: 'update',
    },
    {
      method: 'delete',
      path: detail,
      body: undefined,
      status: 204,
      operation: 'delete',
    },
  ] as const;
  describe('professores ' + resource.path + ' HTTP access denied', () => {
    beforeEach(async () => {
      await setup();
    });
    for (const route of routes)
      it(
        route.method + ' ' + route.path + ' returns 403 without side effects',
        async () => {
          const response = await request(app.getHttpServer())
            [route.method](route.path)
            .set('Authorization', 'Bearer fake-token')
            .send(route.body)
            .expect(403);
          expect(response.body.message).toBe('Forbidden resource');
          noDatabaseCalls();
          expect(passwords.hash).not.toHaveBeenCalled();
        },
      );
    it('blocks malformed IDs and mass assignment before processing', async () => {
      await request(app.getHttpServer())
        .patch(base + '/invalid')
        .send({ senha_hash: 'injected', admin: true })
        .expect(403);
      noDatabaseCalls();
    });
  });
  describe(
    'professores ' + resource.path + ' HTTP contract with fake Prisma',
    () => {
      beforeEach(async () => {
        await setup(true);
      });
      for (const route of routes) {
        it(
          route.method + ' ' + route.path + ' returns explicit safe response',
          async () => {
            const response = await request(app.getHttpServer())
              [route.method](route.path)
              .send(route.body)
              .expect(route.status);
            if (route.status === 204) expect(response.text).toBe('');
            else
              expect(response.body).toEqual(
                route.operation === 'findMany'
                  ? { data: [resource.expected], page: 1, limit: 20, total: 1 }
                  : resource.expected,
              );
            for (const sensitive of [
              'private',
              'senha_hash',
              'cpf',
              'conteudo',
              'telefone',
            ])
              expect(response.text).not.toContain(sensitive);
          },
        );
        it(
          route.method + ' ' + route.path + ' sanitizes database failures',
          async () => {
            const delegate =
              prisma.client[
                resource.model as keyof Omit<
                  typeof prisma.client,
                  '$transaction'
                >
              ];
            delegate[route.operation].mockRejectedValue(
              new Error('private driver failure'),
            );
            const response = await request(app.getHttpServer())
              [route.method](route.path)
              .send(route.body)
              .expect(503);
            expect(response.body.message).toBe(
              'Operacao temporariamente indisponivel.',
            );
            expect(response.text).not.toContain('private');
          },
        );
      }
      it('validates pagination and returns default and empty pages', async () => {
        const response = await request(app.getHttpServer())
          .get(base + '/?page=2&limit=3')
          .expect(200);
        expect(response.body).toEqual({
          data: [resource.expected],
          page: 2,
          limit: 3,
          total: 1,
        });
        const delegate =
          prisma.client[
            resource.model as keyof Omit<typeof prisma.client, '$transaction'>
          ];
        expect(delegate.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ skip: 3, take: 3 }),
        );
        delegate.findMany.mockResolvedValue([]);
        delegate.count.mockResolvedValue(0);
        await request(app.getHttpServer())
          .get(base)
          .expect(200)
          .expect({ data: [], page: 1, limit: 20, total: 0 });
      });
      it.each([
        '?limit=101',
        '?limit=-1',
        '?page=0',
        '?page=1.5',
        '?limit=1&limit=2',
        '?unknown=x',
      ])('rejects invalid pagination %s', async (query) => {
        await request(app.getHttpServer())
          .get(base + query)
          .expect(400);
        noDatabaseCalls();
      });
      it('rejects invalid IDs, unknown properties and empty PATCH', async () => {
        await request(app.getHttpServer())
          .get(base + '/bad')
          .expect(400);
        await request(app.getHttpServer())
          .post(base)
          .send({ ...resource.sample, id: 'injected' })
          .expect(400);
        await request(app.getHttpServer()).patch(detail).send({}).expect(400);
        noDatabaseCalls();
      });
      it('returns 404 for missing GET and PATCH targets', async () => {
        const delegate =
          prisma.client[
            resource.model as keyof Omit<typeof prisma.client, '$transaction'>
          ];
        delegate.findUnique.mockResolvedValue(null);
        await request(app.getHttpServer()).get(detail).expect(404);
        await request(app.getHttpServer())
          .patch(detail)
          .send(resource.patch)
          .expect(404);
        expect(delegate.update).not.toHaveBeenCalled();
      });
      it('returns 404 on missing DELETE', async () => {
        prisma.client[
          resource.model as keyof Omit<typeof prisma.client, '$transaction'>
        ].delete.mockRejectedValue(knownError('P2025'));
        await request(app.getHttpServer()).delete(detail).expect(404);
      });
      it.each(['P2002', 'P2003'])(
        'returns sanitized 409 on constraint %s',
        async (code) => {
          prisma.client[
            resource.model as keyof Omit<typeof prisma.client, '$transaction'>
          ].create.mockRejectedValue(knownError(code));
          const response = await request(app.getHttpServer())
            .post(base)
            .send(resource.sample)
            .expect(409);
          expect(response.body.message).toBe('Conflito nos dados informados.');
          expect(response.text).not.toContain('private');
        },
      );
    },
  );
}

describe('Professor CPF normalization with fake Prisma', () => {
  beforeEach(async () => {
    await setup(true);
  });
  it.each(['12345678901', '123.456.789-01', '11111111111'])(
    'accepts eleven digits without checksum validation',
    async (cpf) => {
      const sample = resources[0].sample;
      const response = await request(app.getHttpServer())
        .post('/professores')
        .send({ ...sample, cpf })
        .expect(201);
      const digits = cpf.replace(/\D/g, '');
      const formatted =
        digits.slice(0, 3) +
        '.' +
        digits.slice(3, 6) +
        '.' +
        digits.slice(6, 9) +
        '-' +
        digits.slice(9);
      expect(prisma.client.professor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cpf: formatted }),
        }),
      );
      expect(response.body).not.toHaveProperty('cpf');
      expect(response.body).not.toHaveProperty('senha_hash');
    },
  );
});
