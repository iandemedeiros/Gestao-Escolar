import { Test } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  type INestApplication,
} from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AcademicHttp } from '../src/academic/academic.http.js';
import { JwtTokens, type Role } from '../src/auth/security.js';
import {
  createPrismaMock,
  avaliacaoRow,
  notaRow,
} from './support/crud-fixtures.js';
const teacher = avaliacaoRow.professor_id,
  student = notaRow.aluno_id,
  other = '123e4567-e89b-42d3-a456-426614174099';
const context = {
  turma_id: avaliacaoRow.turma_id,
  disciplina_id: avaliacaoRow.disciplina_id,
  professor_id: teacher,
};
const evaluationInput = {
  ...context,
  titulo: 'Avaliacao ficticia',
  tipo: 'prova',
  peso: '1.25',
  data_realizacao: '2026-10-01',
  data_entrega_final: '2026-10-02T12:00:00Z',
};
const gradeInput = {
  avaliacao_id: notaRow.avaliacao_id,
  aluno_id: student,
  valor_obtido: '8.50',
};
let app: INestApplication;
let prisma: ReturnType<typeof createPrismaMock>;
const http = { scope: vi.fn(), context: vi.fn(), exists: vi.fn() };
beforeEach(async () => {
  vi.stubEnv(
    'JWT_SECRET',
    'fictional-jwt-key-for-tests-only-at-least-32-bytes',
  );
  prisma = createPrismaMock();
  prisma.client.nota.findUnique.mockResolvedValue({
    ...notaRow,
    avaliacao: context,
  });
  http.scope
    .mockReset()
    .mockResolvedValue({
      contexts: [
        { turma_id: context.turma_id, disciplina_id: context.disciplina_id },
      ],
      aluno_ids: [student],
    });
  http.context.mockReset().mockResolvedValue({ allowed: true });
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
function noWrites() {
  expect(prisma.client.avaliacao.create).not.toHaveBeenCalled();
  expect(prisma.client.avaliacao.update).not.toHaveBeenCalled();
  expect(prisma.client.avaliacao.delete).not.toHaveBeenCalled();
  expect(prisma.client.nota.create).not.toHaveBeenCalled();
  expect(prisma.client.nota.update).not.toHaveBeenCalled();
  expect(prisma.client.nota.delete).not.toHaveBeenCalled();
}
it('creates an evaluation deriving teacher identity from JWT', async () => {
  const { professor_id: _id, ...body } = evaluationInput;
  await request(app.getHttpServer())
    .post('/avaliacoes')
    .set('Authorization', await bearer('PROFESSOR'))
    .send(body)
    .expect(201);
  expect(prisma.client.avaliacao.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ professor_id: teacher }),
    }),
  );
  expect(http.context).toHaveBeenCalledWith(
    expect.objectContaining(context),
    expect.any(String),
  );
});
it('rejects teacher identity chosen by the frontend', async () => {
  await request(app.getHttpServer())
    .post('/avaliacoes')
    .set('Authorization', await bearer('PROFESSOR'))
    .send({ ...evaluationInput, professor_id: other })
    .expect(403);
  noWrites();
});
it('allows an authorized teacher to update evaluation details', async () => {
  await request(app.getHttpServer())
    .patch('/avaliacoes/' + avaliacaoRow.id)
    .set('Authorization', await bearer('PROFESSOR'))
    .send({ peso: '2.50' })
    .expect(200);
  expect(prisma.client.avaliacao.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ AND: context }),
    }),
  );
});
it('blocks edits to evaluations authored by another teacher', async () => {
  await request(app.getHttpServer())
    .patch('/avaliacoes/' + avaliacaoRow.id)
    .set('Authorization', await bearer('PROFESSOR', other))
    .send({ peso: '2.50' })
    .expect(403);
  noWrites();
});
it('blocks a teacher who lost their discipline assignment', async () => {
  http.context.mockRejectedValue(new ForbiddenException());
  await request(app.getHttpServer())
    .patch('/avaliacoes/' + avaliacaoRow.id)
    .set('Authorization', await bearer('PROFESSOR'))
    .send({ peso: '2.50' })
    .expect(403);
  noWrites();
});
it('does not allow an evaluation to move its academic context', async () => {
  await request(app.getHttpServer())
    .patch('/avaliacoes/' + avaliacaoRow.id)
    .set('Authorization', await bearer('SUPER_ADMIN'))
    .send({ turma_id: 99 })
    .expect(409);
  noWrites();
});
it('creates a grade only after confirming student enrollment', async () => {
  await request(app.getHttpServer())
    .post('/notas')
    .set('Authorization', await bearer('PROFESSOR'))
    .send(gradeInput)
    .expect(201);
  expect(http.context).toHaveBeenCalledWith(
    { ...context, aluno_id: student },
    expect.any(String),
  );
  expect(http.exists).toHaveBeenCalledWith(
    'alunos',
    student,
    expect.any(String),
  );
});
it('blocks grade entry for a student outside the evaluation context', async () => {
  http.context.mockRejectedValue(new ForbiddenException('Vinculo ausente'));
  await request(app.getHttpServer())
    .post('/notas')
    .set('Authorization', await bearer('PROFESSOR'))
    .send({ ...gradeInput, aluno_id: other })
    .expect(403);
  noWrites();
});
it('blocks grade edits from a different teacher', async () => {
  await request(app.getHttpServer())
    .patch('/notas/' + notaRow.id)
    .set('Authorization', await bearer('PROFESSOR', other))
    .send({ valor_obtido: '9.00' })
    .expect(403);
  noWrites();
});
it('blocks grade edits for an unassigned discipline', async () => {
  http.context.mockRejectedValue(new ForbiddenException());
  await request(app.getHttpServer())
    .patch('/notas/' + notaRow.id)
    .set('Authorization', await bearer('PROFESSOR'))
    .send({ valor_obtido: '9.00' })
    .expect(403);
  noWrites();
});
it('updates grades in an authorized context and scopes the atomic mutation', async () => {
  await request(app.getHttpServer())
    .patch('/notas/' + notaRow.id)
    .set('Authorization', await bearer('PROFESSOR'))
    .send({ valor_obtido: '9.00' })
    .expect(200);
  expect(prisma.client.nota.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        AND: {
          avaliacao_id: notaRow.avaliacao_id,
          aluno_id: student,
          avaliacao: context,
        },
      }),
    }),
  );
});
it.each([{ aluno_id: other }, { avaliacao_id: other }])(
  'does not transfer a grade to another academic context',
  async (body) => {
    await request(app.getHttpServer())
      .patch('/notas/' + notaRow.id)
      .set('Authorization', await bearer('PROFESSOR'))
      .send(body)
      .expect(409);
    noWrites();
  },
);
it('filters student grades before pagination and count', async () => {
  prisma.client.nota.findMany.mockImplementation(async ({ where }) =>
    where?.aluno_id === student
      ? [notaRow]
      : [notaRow, { ...notaRow, aluno_id: other }],
  );
  prisma.client.nota.count.mockImplementation(async ({ where }) =>
    where?.aluno_id === student ? 1 : 2,
  );
  const response = await request(app.getHttpServer())
    .get('/notas?page=1&limit=5')
    .set('Authorization', await bearer('ALUNO'))
    .expect(200);
  expect(response.body.total).toBe(1);
  expect(response.body.data).toHaveLength(1);
  expect(response.body.data[0].aluno_id).toBe(student);
  expect(prisma.client.nota.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ aluno_id: student }),
      take: 5,
    }),
  );
});
it('forbids a student from reading another student grade by ID', async () => {
  await request(app.getHttpServer())
    .get('/notas/' + notaRow.id)
    .set('Authorization', await bearer('ALUNO', other))
    .expect(403);
  noWrites();
});
it('lets a student read their grade without private fields', async () => {
  const response = await request(app.getHttpServer())
    .get('/notas/' + notaRow.id)
    .set('Authorization', await bearer('ALUNO'))
    .expect(200);
  expect(response.body.aluno_id).toBe(student);
  expect(response.text).not.toContain('senha_hash');
  expect(response.text).not.toContain('private');
});
it('omits the ambiguous global delivery timestamp from student evaluation responses', async () => {
  const response = await request(app.getHttpServer())
    .get('/avaliacoes/' + avaliacaoRow.id)
    .set('Authorization', await bearer('ALUNO'))
    .expect(200);
  expect(response.body).not.toHaveProperty('entrega_do_aluno');
});
it('does not let a student choose another identity as a query filter', async () => {
  await request(app.getHttpServer())
    .get('/notas?aluno_id=' + other)
    .set('Authorization', await bearer('ALUNO'))
    .expect(400);
  expect(prisma.client.nota.findMany).not.toHaveBeenCalled();
});
for (const resource of ['avaliacoes', 'notas'])
  for (const method of ['post', 'patch', 'delete'] as const)
    it('denies student ' + method + ' ' + resource, async () => {
      await request(app.getHttpServer())
        [method]('/' + resource + (method === 'post' ? '' : '/' + notaRow.id))
        .set('Authorization', await bearer('ALUNO'))
        .send(method === 'delete' ? undefined : {})
        .expect(403);
      noWrites();
    });
it('keeps teacher deletion of evaluations administrative', async () => {
  await request(app.getHttpServer())
    .delete('/avaliacoes/' + avaliacaoRow.id)
    .set('Authorization', await bearer('PROFESSOR'))
    .expect(403);
  noWrites();
});
it('allows administrative academic reads and deletion', async () => {
  const token = await bearer('SUPER_ADMIN');
  await request(app.getHttpServer())
    .get('/notas')
    .set('Authorization', token)
    .expect(200);
  await request(app.getHttpServer())
    .delete('/avaliacoes/' + avaliacaoRow.id)
    .set('Authorization', token)
    .expect(204);
});
it('returns 404 for missing external references without writes', async () => {
  http.exists.mockRejectedValue(new NotFoundException());
  await request(app.getHttpServer())
    .post('/avaliacoes')
    .set('Authorization', await bearer('SUPER_ADMIN'))
    .send(evaluationInput)
    .expect(404);
  noWrites();
});
it('returns 404 for a missing evaluation during grade creation', async () => {
  prisma.client.avaliacao.findUnique.mockResolvedValue(null);
  await request(app.getHttpServer())
    .post('/notas')
    .set('Authorization', await bearer('PROFESSOR'))
    .send(gradeInput)
    .expect(404);
  noWrites();
});
it('fails closed on inter-service communication errors', async () => {
  http.scope.mockRejectedValue(
    new ServiceUnavailableException('Integracao indisponivel.'),
  );
  await request(app.getHttpServer())
    .get('/notas')
    .set('Authorization', await bearer('ALUNO'))
    .expect(503);
  expect(prisma.client.nota.findMany).not.toHaveBeenCalled();
});
