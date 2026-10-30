import { Test } from '@nestjs/testing';
import {
  ServiceUnavailableException,
  type INestApplication,
} from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AcademicHttp } from '../src/academic/academic.http.js';
import { JwtTokens } from '../src/auth/security.js';
import { createPrismaMock, alunoRow } from './support/crud-fixtures.js';
let app: INestApplication;
let prisma: ReturnType<typeof createPrismaMock>;
const http = { scope: vi.fn() };
beforeEach(async () => {
  vi.stubEnv(
    'JWT_SECRET',
    'fictional-jwt-key-for-tests-only-at-least-32-bytes',
  );
  vi.stubEnv(
    'INTERNAL_AUTH_TOKEN',
    'fictional-internal-token-for-tests-at-least-32-bytes',
  );
  prisma = createPrismaMock();
  http.scope
    .mockReset()
    .mockResolvedValue({ contexts: [], aluno_ids: [alunoRow.id] });
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
async function token() {
  return (
    'Bearer ' +
    (await new JwtTokens().sign({
      sub: '123e4567-e89b-42d3-a456-426614174011',
      role: 'PROFESSOR',
    }))
  );
}
it('limits professor rosters to authorized student IDs and omits birth dates', async () => {
  const response = await request(app.getHttpServer())
    .get('/alunos')
    .set('Authorization', await token())
    .expect(200);
  expect(response.body.data).toEqual([
    { id: alunoRow.id, nome: alunoRow.nome },
  ]);
  expect(prisma.client.aluno.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: { in: [alunoRow.id] } } }),
  );
  expect(prisma.client.aluno.count).toHaveBeenCalledWith({
    where: { id: { in: [alunoRow.id] } },
  });
});
it('does not broaden an empty professor roster scope', async () => {
  http.scope.mockResolvedValue({ contexts: [], aluno_ids: [] });
  prisma.client.aluno.findMany.mockResolvedValue([]);
  prisma.client.aluno.count.mockResolvedValue(0);
  await request(app.getHttpServer())
    .get('/alunos')
    .set('Authorization', await token())
    .expect(200)
    .expect({ data: [], page: 1, limit: 20, total: 0 });
  expect(prisma.client.aluno.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: { in: [] } } }),
  );
});
it('does not return a student outside the professor scope', async () => {
  http.scope.mockResolvedValue({ contexts: [], aluno_ids: [] });
  await request(app.getHttpServer())
    .get('/alunos/' + alunoRow.id)
    .set('Authorization', await token())
    .expect(403);
  expect(prisma.client.aluno.findUnique).not.toHaveBeenCalled();
});
it('does not fall back to an unrestricted roster on communication failure', async () => {
  http.scope.mockRejectedValue(new ServiceUnavailableException());
  await request(app.getHttpServer())
    .get('/alunos')
    .set('Authorization', await token())
    .expect(503);
  expect(prisma.client.aluno.findMany).not.toHaveBeenCalled();
});
it('requires internal secret and JWT on reference lookup', async () => {
  await request(app.getHttpServer())
    .post('/internal/academic/exists')
    .set('Authorization', await token())
    .send({ id: alunoRow.id })
    .expect(401);
  await request(app.getHttpServer())
    .post('/internal/academic/exists')
    .set('x-internal-auth-token', process.env.INTERNAL_AUTH_TOKEN!)
    .send({ id: alunoRow.id })
    .expect(401);
  expect(prisma.client.aluno.findUnique).not.toHaveBeenCalled();
});
