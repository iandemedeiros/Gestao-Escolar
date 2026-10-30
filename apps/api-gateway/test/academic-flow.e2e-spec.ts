import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule as Gateway } from '../src/app.module.js';
import { JwtTokens } from '../src/auth/security.js';
import { AppModule as Alunos } from '../../alunos/src/app.module.js';
import { PrismaService as AlunosPrisma } from '../../alunos/src/prisma/prisma.service.js';
import {
  createPrismaMock as alunosMock,
  alunoRow,
} from '../../alunos/test/support/crud-fixtures.js';
import { AppModule as Professores } from '../../professores/src/app.module.js';
import { PrismaService as ProfessoresPrisma } from '../../professores/src/prisma/prisma.service.js';
import { createPrismaMock as professoresMock } from '../../professores/test/support/crud-fixtures.js';
import { AppModule as Turmas } from '../../turmas-disciplinas/src/app.module.js';
import { PrismaService as TurmasPrisma } from '../../turmas-disciplinas/src/prisma/prisma.service.js';
import { createPrismaMock as turmasMock } from '../../turmas-disciplinas/test/support/crud-fixtures.js';
import { AppModule as Avaliacoes } from '../../avaliacoes-notas/src/app.module.js';
import { PrismaService as AvaliacoesPrisma } from '../../avaliacoes-notas/src/prisma/prisma.service.js';
import {
  createPrismaMock as avaliacoesMock,
  avaliacaoRow,
  notaRow,
} from '../../avaliacoes-notas/test/support/crud-fixtures.js';
const teacher = avaliacaoRow.professor_id,
  student = notaRow.aluno_id,
  other = '123e4567-e89b-42d3-a456-426614174099',
  discipline = avaliacaoRow.disciplina_id;
let apps: Map<number, INestApplication>,
  gateway: INestApplication,
  td: ReturnType<typeof turmasMock>,
  grades: ReturnType<typeof avaliacoesMock>;
let denyAssignment: boolean, networkFailure: boolean;
async function bearer(
  role: 'ALUNO' | 'PROFESSOR' | 'SUPER_ADMIN',
  sub = role === 'ALUNO' ? student : teacher,
) {
  return (
    'Bearer ' +
    (await new JwtTokens().sign({
      sub: role === 'SUPER_ADMIN' ? 'super-admin' : sub,
      role,
    }))
  );
}
beforeEach(async () => {
  vi.stubEnv(
    'JWT_SECRET',
    'fictional-jwt-key-for-tests-only-at-least-32-bytes',
  );
  vi.stubEnv(
    'INTERNAL_AUTH_TOKEN',
    'fictional-internal-token-for-tests-at-least-32-bytes',
  );
  for (const [key, port] of Object.entries({
    ALUNOS_SERVICE_URL: 3001,
    PROFESSORES_SERVICE_URL: 3002,
    TURMAS_DISCIPLINAS_SERVICE_URL: 3003,
    AVALIACOES_NOTAS_SERVICE_URL: 3004,
  }))
    vi.stubEnv(key, 'http://127.0.0.1:' + port);
  denyAssignment = false;
  networkFailure = false;
  apps = new Map();
  const students = alunosMock();
  students.client.aluno.findUnique.mockImplementation(async ({ where }) =>
    where.id === student ? { id: student } : null,
  );
  students.client.aluno.findMany.mockResolvedValue([
    { ...alunoRow, id: student },
  ]);
  const professors = professoresMock();
  professors.client.professor.findUnique.mockImplementation(
    async ({ where }) => (where.id === teacher ? { id: teacher } : null),
  );
  td = turmasMock();
  Object.assign(td.client.alocacao_professor, {
    findFirst: vi.fn(async ({ where }) =>
      !denyAssignment &&
      where.professor_id === teacher &&
      where.disciplina_id === discipline
        ? { id: teacher }
        : null,
    ),
  });
  Object.assign(td.client.alocacao_aluno, {
    findFirst: vi.fn(async ({ where }) =>
      where.turma_id === 1 &&
      where.disciplina_id === discipline &&
      (!where.aluno_id || where.aluno_id === student)
        ? { id: student }
        : null,
    ),
  });
  td.client.alocacao_aluno.findMany.mockImplementation(
    async ({ where, select }) => {
      if (where.aluno_id && where.aluno_id !== student) return [];
      return select.aluno_id
        ? [{ aluno_id: student }]
        : [{ turma_id: 1, disciplina_id: discipline }];
    },
  );
  grades = avaliacoesMock();
  const grade = { ...notaRow, avaliacao_id: avaliacaoRow.id };
  grades.client.nota.findUnique.mockResolvedValue({
    ...grade,
    avaliacao: avaliacaoRow,
  });
  grades.client.nota.create.mockImplementation(async ({ data }) => ({
    ...grade,
    ...data,
  }));
  grades.client.nota.findMany.mockImplementation(async ({ where }) =>
    where?.aluno_id && where.aluno_id !== student ? [] : [grade],
  );
  const declarations = [
    [3001, Alunos, AlunosPrisma, students],
    [3002, Professores, ProfessoresPrisma, professors],
    [3003, Turmas, TurmasPrisma, td],
    [3004, Avaliacoes, AvaliacoesPrisma, grades],
  ] as const;
  for (const [port, app, provider, db] of declarations) {
    const module = await Test.createTestingModule({ imports: [app] })
      .overrideProvider(provider)
      .useValue(db)
      .compile();
    const instance = module.createNestApplication();
    await instance.init();
    apps.set(port, instance);
  }
  const module = await Test.createTestingModule({
    imports: [Gateway],
  }).compile();
  gateway = module.createNestApplication();
  await gateway.init();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: URL | string, options: RequestInit) => {
      const url = new URL(String(input));
      if (networkFailure && url.port === '3003')
        throw new Error('simulated network failure');
      const target = apps.get(Number(url.port));
      if (!target) throw new Error('Unexpected target');
      const method = (options.method ?? 'GET').toLowerCase() as
        'get' | 'post' | 'patch' | 'delete';
      const call = request(target.getHttpServer())[method](
        url.pathname + url.search,
      );
      new Headers(options.headers).forEach((value, key) => {
        call.set(key, value);
      });
      if (options.body) {
        if (typeof options.body !== 'string')
          throw new Error('Unexpected mock transport body');
        call.send(JSON.parse(options.body));
      }
      const result = await call;
      return new Response(
        result.status === 204 ? null : JSON.stringify(result.body),
        {
          status: result.status,
          headers: { 'content-type': 'application/json' },
        },
      );
    }),
  );
});
afterEach(async () => {
  await gateway?.close();
  for (const app of apps.values()) await app.close();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('runs professor evaluation and grade entry then student grade reading through Gateway', async () => {
  const token = await bearer('PROFESSOR');
  await request(gateway.getHttpServer())
    .post('/avaliacoes')
    .set('Authorization', token)
    .send({
      turma_id: 1,
      disciplina_id: discipline,
      titulo: 'Avaliacao ficticia',
      tipo: 'prova',
      peso: '1.25',
      data_realizacao: '2026-10-01',
      data_entrega_final: '2026-10-02T12:00:00Z',
    })
    .expect(201);
  expect(grades.client.avaliacao.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ professor_id: teacher }),
    }),
  );
  await request(gateway.getHttpServer())
    .post('/notas')
    .set('Authorization', token)
    .send({
      avaliacao_id: avaliacaoRow.id,
      aluno_id: student,
      valor_obtido: '8.50',
    })
    .expect(201);
  const response = await request(gateway.getHttpServer())
    .get('/notas')
    .set('Authorization', await bearer('ALUNO'))
    .expect(200);
  expect(response.body.data[0].aluno_id).toBe(student);
  expect(response.body.data[0].valor_obtido).toBe('8.50');
  expect(response.text).not.toContain('senha_hash');
});
it('runs a professor roster and discipline read using actual internal scope controllers', async () => {
  const token = await bearer('PROFESSOR');
  await request(gateway.getHttpServer())
    .get('/disciplinas')
    .set('Authorization', token)
    .expect(200);
  const response = await request(gateway.getHttpServer())
    .get('/alunos')
    .set('Authorization', token)
    .expect(200);
  expect(response.body.data).toEqual([{ id: student, nome: alunoRow.nome }]);
});
it('rejects grade editing when the teacher lacks discipline permission', async () => {
  denyAssignment = true;
  await request(gateway.getHttpServer())
    .patch('/notas/' + notaRow.id)
    .set('Authorization', await bearer('PROFESSOR'))
    .send({ valor_obtido: '9.00' })
    .expect(403);
  expect(grades.client.nota.update).not.toHaveBeenCalled();
});
it('rejects reading a different student grade through Gateway', async () => {
  await request(gateway.getHttpServer())
    .get('/notas/' + notaRow.id)
    .set('Authorization', await bearer('ALUNO', other))
    .expect(403);
});
it('returns missing external references without creating grades', async () => {
  await request(gateway.getHttpServer())
    .post('/notas')
    .set('Authorization', await bearer('PROFESSOR'))
    .send({
      avaliacao_id: avaliacaoRow.id,
      aluno_id: other,
      valor_obtido: '8.50',
    })
    .expect(404);
  expect(grades.client.nota.create).not.toHaveBeenCalled();
});
it('fails closed when internal academic validation is unavailable', async () => {
  networkFailure = true;
  await request(gateway.getHttpServer())
    .post('/notas')
    .set('Authorization', await bearer('PROFESSOR'))
    .send({
      avaliacao_id: avaliacaoRow.id,
      aluno_id: student,
      valor_obtido: '8.50',
    })
    .expect(503);
  expect(grades.client.nota.create).not.toHaveBeenCalled();
});
it('keeps administrative student listing available through Gateway', async () => {
  await request(gateway.getHttpServer())
    .get('/alunos')
    .set('Authorization', await bearer('SUPER_ADMIN'))
    .expect(200);
});
