import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordHasher } from '../src/alunos/password-hasher.service.js';
import { AlunosAccessGuard } from '../src/alunos/alunos-access.guard.js';
import {
  alunoId,
  otherAlunoId,
  contatoId,
  alunoInput,
  alunoResponse,
  contatoResponse,
  knownError,
  createPrismaMock,
} from './support/crud-fixtures.js';

type Mock = ReturnType<typeof createPrismaMock>;
const base = '/alunos/' + alunoId;
const contacts = base + '/contatos';
const item = contacts + '/' + contatoId;
const routes = [
  {
    method: 'get',
    path: '/alunos',
    body: undefined,
    status: 200,
    fail: (m: Mock, error: Error) =>
      m.client.aluno.findMany.mockRejectedValue(error),
  },
  {
    method: 'get',
    path: base,
    body: undefined,
    status: 200,
    fail: (m: Mock, error: Error) =>
      m.client.aluno.findUnique.mockRejectedValue(error),
  },
  {
    method: 'post',
    path: '/alunos',
    body: alunoInput,
    status: 201,
    fail: (m: Mock, error: Error) =>
      m.client.aluno.create.mockRejectedValue(error),
  },
  {
    method: 'patch',
    path: base,
    body: { nome: 'Novo nome' },
    status: 200,
    fail: (m: Mock, error: Error) =>
      m.client.aluno.update.mockRejectedValue(error),
  },
  {
    method: 'delete',
    path: base,
    body: undefined,
    status: 204,
    fail: (m: Mock, error: Error) =>
      m.client.aluno.delete.mockRejectedValue(error),
  },
  {
    method: 'get',
    path: contacts,
    body: undefined,
    status: 200,
    fail: (m: Mock, error: Error) =>
      m.client.contato.findMany.mockRejectedValue(error),
  },
  {
    method: 'post',
    path: contacts,
    body: { telefone: '12345678' },
    status: 201,
    fail: (m: Mock, error: Error) =>
      m.client.contato.create.mockRejectedValue(error),
  },
  {
    method: 'patch',
    path: item,
    body: { celular: null },
    status: 200,
    fail: (m: Mock, error: Error) =>
      m.client.contato.update.mockRejectedValue(error),
  },
  {
    method: 'delete',
    path: item,
    body: undefined,
    status: 204,
    fail: (m: Mock, error: Error) =>
      m.client.contato.delete.mockRejectedValue(error),
  },
] as const;
let app: INestApplication;
let prisma: Mock;
let hash: ReturnType<typeof vi.fn>;

async function setup(overrideGuard = false) {
  prisma = createPrismaMock();
  hash = vi.fn().mockResolvedValue('$argon2id$test-placeholder');
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(PasswordHasher)
    .useValue({ hash });
  // Test-only bypass. No application flag/header can enable these endpoints.
  if (overrideGuard)
    builder
      .overrideGuard(AlunosAccessGuard)
      .useValue({ canActivate: () => true });
  const module = await builder.compile();
  app = module.createNestApplication();
  await app.init();
}
function allDatabaseCalls() {
  return Object.values(prisma.client.aluno).concat(
    Object.values(prisma.client.contato),
  );
}
afterEach(async () => {
  await app?.close();
});

describe('Complete CRUD remains forbidden over HTTP', () => {
  beforeEach(async () => {
    await setup();
  });
  for (const route of routes) {
    it(
      route.method +
        ' ' +
        route.path +
        ' blocks access before validation, hashing or Prisma',
      async () => {
        await request(app.getHttpServer())
          [route.method](route.path)
          .set('Authorization', 'Bearer fake-token')
          .send(route.body)
          .expect(401);
        for (const method of allDatabaseCalls())
          expect(method).not.toHaveBeenCalled();
        expect(prisma.client.$transaction).not.toHaveBeenCalled();
        expect(hash).not.toHaveBeenCalled();
      },
    );
  }
  it('also blocks requests with invalid data and the trailing slash', async () => {
    await request(app.getHttpServer())
      .post('/alunos/')
      .send({ senha_hash: 'injected' })
      .expect(401);
    await request(app.getHttpServer())
      .patch('/alunos/bad/contatos/bad')
      .send({ aluno_id: otherAlunoId })
      .expect(401);
    for (const method of allDatabaseCalls())
      expect(method).not.toHaveBeenCalled();
  });
  it('keeps health working independently of CRUD/database access', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ service: 'alunos', status: 'ok' });
    for (const method of allDatabaseCalls())
      expect(method).not.toHaveBeenCalled();
  });
});

describe('CRUD HTTP contract with fake Prisma and test-only authorization', () => {
  beforeEach(async () => {
    await setup(true);
  });
  for (const route of routes) {
    it(
      route.method + ' ' + route.path + ' success returns only minimal fields',
      async () => {
        const response = await request(app.getHttpServer())
          [route.method](route.path)
          .send(route.body)
          .expect(route.status);
        if (route.status === 204) {
          expect(response.text).toBe('');
        } else {
          const expected = route.path.includes('/contatos')
            ? contatoResponse
            : alunoResponse;
          expect(response.body).toEqual(
            route.method === 'get' &&
              (route.path === '/alunos' || route.path === contacts)
              ? { data: [expected], page: 1, limit: 20, total: 1 }
              : expected,
          );
        }
      },
    );
    it(
      route.method +
        ' ' +
        route.path +
        ' converts driver failures to sanitized 503',
      async () => {
        route.fail(prisma, new Error('private driver details'));
        const response = await request(app.getHttpServer())
          [route.method](route.path)
          .send(route.body)
          .expect(503);
        expect(response.body.message).toBe('Consulta de aluno indisponivel.');
        expect(JSON.stringify(response.body)).not.toContain('private');
      },
    );
  }
  it('accepts pagination and uses bounded SQL arguments', async () => {
    const response = await request(app.getHttpServer())
      .get('/alunos?page=2&limit=5')
      .expect(200);
    expect(response.body).toEqual({
      data: [alunoResponse],
      page: 2,
      limit: 5,
      total: 1,
    });
    expect(prisma.client.aluno.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });
  it.each([
    '/alunos?limit=101',
    '/alunos?limit=-1',
    '/alunos?page=0',
    '/alunos?limit=1&limit=2',
    contacts + '?page=1.5',
  ])('rejects invalid pagination %s', async (path) => {
    await request(app.getHttpServer()).get(path).expect(400);
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
  });
  it.each(['/alunos/bad', '/alunos/bad/contatos'])(
    'rejects invalid aluno ID %s',
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(400);
      for (const method of allDatabaseCalls())
        expect(method).not.toHaveBeenCalled();
    },
  );
  it('rejects invalid contact ID before any write', async () => {
    await request(app.getHttpServer())
      .patch(contacts + '/bad')
      .send({ telefone: '123' })
      .expect(400);
    expect(prisma.client.contato.update).not.toHaveBeenCalled();
  });
  it.each([
    {
      method: 'post',
      path: '/alunos',
      body: { ...alunoInput, senha_hash: 'injected' },
    },
    { method: 'patch', path: base, body: {} },
    { method: 'patch', path: base, body: { id: otherAlunoId } },
    {
      method: 'post',
      path: contacts,
      body: { aluno_id: otherAlunoId, telefone: '123' },
    },
    { method: 'patch', path: item, body: { aluno_id: otherAlunoId } },
    { method: 'patch', path: item, body: {} },
    { method: 'post', path: contacts, body: {} },
  ] as const)('rejects unsafe body on $method $path', async (route) => {
    const response = await request(app.getHttpServer())
      [route.method](route.path)
      .send(route.body)
      .expect(400);
    expect(response.body.message).toBe('Entrada invalida.');
    expect(hash).not.toHaveBeenCalled();
    for (const method of allDatabaseCalls())
      expect(method).not.toHaveBeenCalled();
  });
  it('maps missing aluno lookup to 404', async () => {
    prisma.client.aluno.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer()).get(base).expect(404);
  });
  it.each(['get', 'post'] as const)(
    'does not access contacts of a missing parent during %s',
    async (method) => {
      prisma.client.aluno.findUnique.mockResolvedValue(null);
      await request(app.getHttpServer())
        [method](contacts)
        .send(method === 'post' ? { telefone: '123' } : undefined)
        .expect(404);
      expect(prisma.client.contato.create).not.toHaveBeenCalled();
      expect(prisma.client.contato.findMany).not.toHaveBeenCalled();
    },
  );
  it.each(['patch', 'delete'] as const)(
    'returns 404 when aluno disappears during %s',
    async (method) => {
      prisma.client.aluno[
        method === 'patch' ? 'update' : 'delete'
      ].mockRejectedValue(knownError('P2025'));
      await request(app.getHttpServer())
        [method](base)
        .send(method === 'patch' ? { nome: 'Novo nome' } : undefined)
        .expect(404);
    },
  );
  it.each(['patch', 'delete'] as const)(
    'isolates contacts of other alunos during %s',
    async (method) => {
      const operation = method === 'patch' ? 'update' : 'delete';
      prisma.client.contato[operation].mockImplementation(async ({ where }) => {
        if (where.aluno_id !== alunoId) throw knownError('P2025');
        return contatoResponse;
      });
      await request(app.getHttpServer())
        [method]('/alunos/' + otherAlunoId + '/contatos/' + contatoId)
        .send(method === 'patch' ? { telefone: '123' } : undefined)
        .expect(404);
      expect(prisma.client.contato[operation]).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: contatoId, aluno_id: otherAlunoId },
        }),
      );
    },
  );
  it.each(['post', 'patch'] as const)(
    'maps unique %s conflicts to sanitized 409',
    async (method) => {
      prisma.client.aluno[
        method === 'post' ? 'create' : 'update'
      ].mockRejectedValue(knownError('P2002'));
      const response = await request(app.getHttpServer())
        [method](method === 'post' ? '/alunos' : base)
        .send(method === 'post' ? alunoInput : { email: alunoInput.email })
        .expect(409);
      expect(response.body.message).toBe('Conflito nos dados informados.');
    },
  );
  it('handles a foreign-key race without returning SQL details', async () => {
    prisma.client.contato.create.mockRejectedValue(knownError('P2003'));
    const response = await request(app.getHttpServer())
      .post(contacts)
      .send({ telefone: '123' })
      .expect(409);
    expect(response.body.message).toBe('Conflito nos dados informados.');
  });
  it('returns empty paginated collections safely', async () => {
    prisma.client.aluno.findMany.mockResolvedValue([]);
    prisma.client.aluno.count.mockResolvedValue(0);
    await request(app.getHttpServer())
      .get('/alunos')
      .expect(200)
      .expect({ data: [], page: 1, limit: 20, total: 0 });
    prisma.client.contato.findMany.mockResolvedValue([]);
    prisma.client.contato.count.mockResolvedValue(0);
    await request(app.getHttpServer())
      .get(contacts)
      .expect(200)
      .expect({ data: [], page: 1, limit: 20, total: 0 });
  });
});
