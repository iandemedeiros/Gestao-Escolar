import { Test } from '@nestjs/testing';
import {
  NotFoundException,
  ServiceUnavailableException,
  type INestApplication,
} from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AcademicHttp } from '../src/academic/academic.http.js';
import { JwtTokens, type Role } from '../src/auth/security.js';
import { createPrismaMock } from './support/crud-fixtures.js';
const teacher = '123e4567-e89b-42d3-a456-426614174011',
  student = '123e4567-e89b-42d3-a456-426614174012',
  discipline = '123e4567-e89b-42d3-a456-426614174010',
  other = '123e4567-e89b-42d3-a456-426614174099';
const internal = 'fictional-internal-token-for-tests-at-least-32-bytes';
let app: INestApplication;
function db() {
  const mock = createPrismaMock();
  return {
    client: {
      ...mock.client,
      alocacao_aluno: {
        ...mock.client.alocacao_aluno,
        findFirst: vi.fn().mockResolvedValue({ id: student }),
      },
      alocacao_professor: {
        ...mock.client.alocacao_professor,
        findFirst: vi.fn().mockResolvedValue({ id: teacher }),
      },
    },
  };
}
let prisma: ReturnType<typeof db>;
const http = { exists: vi.fn() };
beforeEach(async () => {
  vi.stubEnv(
    'JWT_SECRET',
    'fictional-jwt-key-for-tests-only-at-least-32-bytes',
  );
  vi.stubEnv('INTERNAL_AUTH_TOKEN', internal);
  prisma = db();
  http.exists.mockReset().mockResolvedValue({ exists: true });
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(AcademicHttp)
    .useValue(http)
    .compile();
  app = module.createNestApplication();
  await app.init();
});
afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
});
async function bearer(role: Role, sub = role === 'ALUNO' ? student : teacher) {
  return (
    'Bearer ' +
    (await new JwtTokens().sign({
      sub: role === 'SUPER_ADMIN' ? 'super-admin' : sub,
      role,
    }))
  );
}
it('filters professor disciplines by real allocation', async () => {
  await request(app.getHttpServer())
    .get('/disciplinas')
    .set('Authorization', await bearer('PROFESSOR'))
    .expect(200);
  expect(prisma.client.disciplina.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { alocacao_professor: { some: { professor_id: teacher } } },
    }),
  );
});
it('derives professor turmas through student allocations of the assigned discipline', async () => {
  await request(app.getHttpServer())
    .get('/turmas')
    .set('Authorization', await bearer('PROFESSOR'))
    .expect(200);
  expect(prisma.client.turma.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        alocacao_aluno: {
          some: {
            disciplina: {
              alocacao_professor: { some: { professor_id: teacher } },
            },
          },
        },
      },
    }),
  );
});
it('filters student allocations by JWT subject before pagination and count', async () => {
  await request(app.getHttpServer())
    .get('/alocacoes-alunos?limit=5')
    .set('Authorization', await bearer('ALUNO'))
    .expect(200);
  expect(prisma.client.alocacao_aluno.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { aluno_id: student }, take: 5 }),
  );
  expect(prisma.client.alocacao_aluno.count).toHaveBeenCalledWith({
    where: { aluno_id: student },
  });
});
it('does not let alunos inspect teacher allocation lists', async () => {
  await request(app.getHttpServer())
    .get('/alocacoes-professores')
    .set('Authorization', await bearer('ALUNO'))
    .expect(403);
});
it.each(['ALUNO', 'PROFESSOR'] as const)(
  'does not let %s change allocations',
  async (role) => {
    await request(app.getHttpServer())
      .post('/alocacoes-alunos')
      .set('Authorization', await bearer(role))
      .send({})
      .expect(403);
    expect(prisma.client.alocacao_aluno.create).not.toHaveBeenCalled();
  },
);
it('allows Super Admin allocations after external existence validation', async () => {
  await request(app.getHttpServer())
    .post('/alocacoes-alunos')
    .set('Authorization', await bearer('SUPER_ADMIN'))
    .send({ aluno_id: student, turma_id: 1, disciplina_id: discipline })
    .expect(201);
  expect(http.exists).toHaveBeenCalledWith(
    'alunos',
    student,
    expect.any(String),
  );
});
it('rejects nonexistent external allocation references', async () => {
  http.exists.mockRejectedValue(new NotFoundException());
  await request(app.getHttpServer())
    .post('/alocacoes-professores')
    .set('Authorization', await bearer('SUPER_ADMIN'))
    .send({ professor_id: teacher, disciplina_id: discipline })
    .expect(404);
  expect(prisma.client.alocacao_professor.create).not.toHaveBeenCalled();
});
it('fails closed on reference communication failures', async () => {
  http.exists.mockRejectedValue(new ServiceUnavailableException());
  await request(app.getHttpServer())
    .post('/alocacoes-alunos')
    .set('Authorization', await bearer('SUPER_ADMIN'))
    .send({ aluno_id: student, turma_id: 1, disciplina_id: discipline })
    .expect(503);
  expect(prisma.client.alocacao_aluno.create).not.toHaveBeenCalled();
});
it('requires internal secret and JWT for scope', async () => {
  const token = await bearer('PROFESSOR');
  await request(app.getHttpServer())
    .post('/internal/academic/scope')
    .set('Authorization', token)
    .send({})
    .expect(401);
  await request(app.getHttpServer())
    .post('/internal/academic/scope')
    .set('x-internal-auth-token', internal)
    .send({})
    .expect(401);
});
it('does not accept an actor identity in a scope request body', async () => {
  await request(app.getHttpServer())
    .post('/internal/academic/scope')
    .set('x-internal-auth-token', internal)
    .set('Authorization', await bearer('ALUNO'))
    .send({ aluno_id: other })
    .expect(400);
});
it('returns only bounded IDs and context pairs in internal scope', async () => {
  prisma.client.alocacao_aluno.findMany
    .mockResolvedValueOnce([{ turma_id: 1, disciplina_id: discipline }])
    .mockResolvedValueOnce([{ aluno_id: student }]);
  await request(app.getHttpServer())
    .post('/internal/academic/scope')
    .set('x-internal-auth-token', internal)
    .set('Authorization', await bearer('PROFESSOR'))
    .send({})
    .expect(200)
    .expect({
      contexts: [{ turma_id: 1, disciplina_id: discipline }],
      aluno_ids: [student],
    });
});
it('bounds large academic scopes rather than silently granting partial authorization', async () => {
  prisma.client.alocacao_aluno.findMany.mockResolvedValue(
    Array.from({ length: 10001 }, () => ({
      turma_id: 1,
      disciplina_id: discipline,
      aluno_id: student,
    })),
  );
  await request(app.getHttpServer())
    .post('/internal/academic/scope')
    .set('x-internal-auth-token', internal)
    .set('Authorization', await bearer('ALUNO'))
    .send({})
    .expect(503);
});
it('validates the provisional teacher-discipline-turma rule', async () => {
  await request(app.getHttpServer())
    .post('/internal/academic/context')
    .set('x-internal-auth-token', internal)
    .set('Authorization', await bearer('PROFESSOR'))
    .send({
      turma_id: 1,
      disciplina_id: discipline,
      professor_id: teacher,
      aluno_id: student,
    })
    .expect(200);
  expect(prisma.client.alocacao_professor.findFirst).toHaveBeenCalledWith({
    where: { professor_id: teacher, disciplina_id: discipline },
    select: { id: true },
  });
  expect(prisma.client.alocacao_aluno.findFirst).toHaveBeenCalledWith({
    where: { turma_id: 1, disciplina_id: discipline, aluno_id: student },
    select: { id: true },
  });
});
it('rejects teacher context when allocation does not exist', async () => {
  prisma.client.alocacao_professor.findFirst.mockResolvedValue(null);
  await request(app.getHttpServer())
    .post('/internal/academic/context')
    .set('x-internal-auth-token', internal)
    .set('Authorization', await bearer('PROFESSOR'))
    .send({ turma_id: 1, disciplina_id: discipline })
    .expect(403);
});
it('rejects a different student identity and unallocated student contexts', async () => {
  const token = await bearer('ALUNO');
  await request(app.getHttpServer())
    .post('/internal/academic/context')
    .set('x-internal-auth-token', internal)
    .set('Authorization', token)
    .send({ turma_id: 1, disciplina_id: discipline, aluno_id: other })
    .expect(403);
  prisma.client.alocacao_aluno.findFirst.mockResolvedValue(null);
  await request(app.getHttpServer())
    .post('/internal/academic/context')
    .set('x-internal-auth-token', internal)
    .set('Authorization', token)
    .send({ turma_id: 1, disciplina_id: discipline })
    .expect(403);
});
it('returns 404 for absent local context references', async () => {
  prisma.client.turma.findUnique.mockResolvedValue(null);
  await request(app.getHttpServer())
    .post('/internal/academic/context')
    .set('x-internal-auth-token', internal)
    .set('Authorization', await bearer('SUPER_ADMIN'))
    .send({ turma_id: 1, disciplina_id: discipline })
    .expect(404);
});
