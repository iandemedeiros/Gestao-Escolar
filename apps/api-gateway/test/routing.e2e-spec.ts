import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { JwtTokens } from '../src/auth/security.js';
let app: INestApplication;
const fetchMock = vi.fn();
let token: string;
beforeEach(async () => {
  vi.stubEnv(
    'JWT_SECRET',
    'fictional-jwt-key-for-tests-only-at-least-32-bytes',
  );
  vi.stubGlobal('fetch', fetchMock);
  fetchMock
    .mockReset()
    .mockResolvedValue(
      new Response(JSON.stringify({ data: [], page: 1, limit: 20, total: 0 }), {
        status: 200,
      }),
    );
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = module.createNestApplication();
  await app.init();
  token =
    'Bearer ' +
    (await new JwtTokens().sign({ sub: 'super-admin', role: 'SUPER_ADMIN' }));
});
afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it.each([
  ['alunos', 3001, 'alunos'],
  ['professores', 3002, 'professores'],
  ['turmas', 3003, 'turmas'],
  ['disciplinas', 3003, 'disciplinas'],
  ['alocacoes-alunos', 3003, 'alocacoes-alunos'],
  ['alocacoes-professores', 3003, 'alocacoes-professores'],
  ['avaliacoes', 3004, 'avaliacoes'],
  ['notas', 3004, 'notas'],
  ['mensagens', 3005, 'mensagens'],
  ['tipos-mensagem', 3005, 'tipos-mensagem'],
  ['contatos-professores', 3002, 'contatos'],
  ['disponibilidades-professores', 3002, 'disponibilidades'],
] as const)('routes %s to its owning service', async (path, port, target) => {
  await request(app.getHttpServer())
    .get('/' + path + '?page=2&limit=5')
    .set('Authorization', token)
    .expect(200);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url.port).toBe(String(port));
  expect(url.pathname).toBe('/' + target);
  expect(url.search).toBe('?page=2&limit=5');
  expect(options.headers.authorization).toBe(token);
});
it('preserves nested aluno contacts paths and repeated query parameters', async () => {
  await request(app.getHttpServer())
    .get(
      '/alunos/123e4567-e89b-42d3-a456-426614174000/contatos?limit=1&limit=2',
    )
    .set('Authorization', token)
    .expect(200);
  expect(fetchMock.mock.calls[0][0].pathname).toBe(
    '/alunos/123e4567-e89b-42d3-a456-426614174000/contatos',
  );
  expect(fetchMock.mock.calls[0][0].search).toBe('?limit=1&limit=2');
});
it.each(['post', 'patch'] as const)(
  'preserves %s method, body and success status',
  async (method) => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), {
        status: method === 'post' ? 201 : 200,
      }),
    );
    await request(app.getHttpServer())
      [method]('/turmas' + (method === 'patch' ? '/1' : ''))
      .set('Authorization', token)
      .send({ nome: 'Turma ficticia' })
      .expect(method === 'post' ? 201 : 200);
    expect(fetchMock.mock.calls[0][1].method).toBe(method.toUpperCase());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      nome: 'Turma ficticia',
    });
  },
);
it('preserves empty 204 deletion responses', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  const response = await request(app.getHttpServer())
    .delete('/turmas/1')
    .set('Authorization', token)
    .expect(204);
  expect(response.text).toBe('');
});
it.each([400, 401, 403, 404, 409, 429, 500, 503])(
  'preserves upstream %s while sanitizing its body',
  async (status) => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'private driver credentials' }), {
        status,
      }),
    );
    const response = await request(app.getHttpServer())
      .get('/notas')
      .set('Authorization', token)
      .expect(status);
    expect(response.body.statusCode).toBe(status);
    expect(response.text).not.toContain('private');
  },
);
it('does not forward user supplied roles, cookies, or internal secrets', async () => {
  await request(app.getHttpServer())
    .get('/alunos')
    .set('Authorization', token)
    .set('x-role', 'SUPER_ADMIN')
    .set('x-internal-auth-token', 'injected')
    .set('Cookie', 'secret=cookie')
    .expect(200);
  expect(fetchMock.mock.calls[0][1].headers).toEqual({
    authorization: token,
    'content-type': 'application/json',
    accept: 'application/json',
  });
});
it('does not proxy internal endpoints', async () => {
  await request(app.getHttpServer())
    .post('/internal/academic/scope')
    .set('Authorization', token)
    .send({})
    .expect(404);
  expect(fetchMock).not.toHaveBeenCalled();
});
it('does not forward requests lacking a valid JWT', async () => {
  await request(app.getHttpServer()).get('/alunos').expect(401);
  expect(fetchMock).not.toHaveBeenCalled();
});
it('rejects encoded path separators instead of changing the target path', async () => {
  await request(app.getHttpServer())
    .get('/alunos/x%2Fy')
    .set('Authorization', token)
    .expect(400);
  expect(fetchMock).not.toHaveBeenCalled();
});
it('does not leak private fields from malformed upstream success bodies', async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ senha_hash: 'private' }), { status: 200 }),
  );
  const response = await request(app.getHttpServer())
    .get('/professores')
    .set('Authorization', token)
    .expect(503);
  expect(response.text).not.toContain('private');
});
it('sanitizes connection and timeout errors', async () => {
  fetchMock.mockRejectedValue(new Error('private URL'));
  const response = await request(app.getHttpServer())
    .get('/alunos')
    .set('Authorization', token)
    .expect(503);
  expect(response.text).not.toContain('private');
});
