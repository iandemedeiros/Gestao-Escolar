import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AlunosAccessGuard } from '../src/alunos/alunos-access.guard.js';

const id = '123e4567-e89b-42d3-a456-426614174000';
const findUnique = vi.fn();
let app: INestApplication;

async function createApp(overrideGuard = false) {
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({ client: { aluno: { findUnique } } });
  // Only this in-memory test application bypasses authorization, with fake Prisma.
  if (overrideGuard)
    builder
      .overrideGuard(AlunosAccessGuard)
      .useValue({ canActivate: () => true });
  const module = await builder.compile();
  app = module.createNestApplication();
  await app.init();
}

afterEach(async () => {
  await app?.close();
  findUnique.mockReset();
});

describe('Alunos HTTP authorization enforced', () => {
  beforeEach(async () => {
    await createApp();
  });

  it.each(['/alunos/', '/alunos/' + id, '/alunos/invalid'])(
    'blocks %s without touching Prisma',
    async (path) => {
      const response = await request(app.getHttpServer()).get(path).expect(401);
      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Nao autenticado.',
        error: 'Unauthorized',
      });
      expect(findUnique).not.toHaveBeenCalled();
    },
  );

  it('does not accept an arbitrary authorization header', async () => {
    await request(app.getHttpServer())
      .get('/alunos/' + id)
      .set('Authorization', 'Bearer fake-token')
      .expect(401);
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe('Alunos HTTP contract with test-only authorization and fake Prisma', () => {
  beforeEach(async () => {
    await createApp(true);
  });

  it('returns 400 for an invalid UUID without querying', async () => {
    await request(app.getHttpServer()).get('/alunos/invalid').expect(400);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when no aluno exists', async () => {
    findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get('/alunos/' + id)
      .expect(404);
  });

  it('returns only allowed fields using fictional data', async () => {
    findUnique.mockResolvedValue({
      id,
      nome: 'Aluno ficticio',
      data_nascimento: new Date('2000-01-02T00:00:00Z'),
      cpf: 'private',
      email: 'private',
      senha_hash: 'private',
      contato: ['private'],
      endereco_rua: 'private',
    });
    await request(app.getHttpServer())
      .get('/alunos/' + id)
      .expect(200)
      .expect({ id, nome: 'Aluno ficticio', data_nascimento: '2000-01-02' });
  });

  it('does not expose database error details', async () => {
    findUnique.mockRejectedValue(new Error('private driver details'));
    const response = await request(app.getHttpServer())
      .get('/alunos/' + id)
      .expect(503);
    expect(response.body.message).toBe('Consulta de aluno indisponivel.');
  });
});
