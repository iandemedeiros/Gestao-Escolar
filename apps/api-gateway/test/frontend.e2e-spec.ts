import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureFrontend } from '../src/openapi/setup.js';
let app: INestApplication;
const fetchMock = vi.fn();
beforeAll(async () => {
  vi.stubEnv(
    'FRONTEND_ORIGINS',
    'http://localhost:4200,http://localhost:5173,http://localhost:3000',
  );
  vi.stubGlobal('fetch', fetchMock);
  app = (
    await Test.createTestingModule({ imports: [AppModule] }).compile()
  ).createNestApplication();
  configureFrontend(app);
  await app.init();
});
afterAll(async () => {
  await app.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('serves Swagger UI and JSON publicly without contacting any service', async () => {
  const ui = await request(app.getHttpServer()).get('/api/docs').expect(200);
  expect(ui.text).toContain('swagger-ui');
  const json = await request(app.getHttpServer())
    .get('/api/docs-json')
    .expect(200);
  expect(json.body.openapi).toBe('3.0.3');
  expect(json.body.paths['/auth/login']).toBeDefined();
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each([4200, 5173, 3000])('allows frontend on localhost:%s', async (port) => {
  const origin = 'http://localhost:' + port;
  const result = await request(app.getHttpServer())
    .get('/health')
    .set('Origin', origin)
    .expect(200);
  expect(result.headers['access-control-allow-origin']).toBe(origin);
  expect(result.headers['access-control-allow-credentials']).toBeUndefined();
});
it('answers authorized preflights before the JWT guard', async () => {
  const result = await request(app.getHttpServer())
    .options('/alunos')
    .set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'authorization,content-type')
    .expect(204);
  expect(result.headers['access-control-allow-headers']).toBe(
    'Authorization,Content-Type',
  );
  expect(result.headers['access-control-allow-methods']).toContain('PATCH');
});
it('does not authorize other browser origins, while preserving health and JWT authentication', async () => {
  const result = await request(app.getHttpServer())
    .get('/health')
    .set('Origin', 'https://other.invalid')
    .expect(200);
  expect(result.headers['access-control-allow-origin']).toBeUndefined();
  await request(app.getHttpServer()).get('/health').expect(200);
  await request(app.getHttpServer())
    .get('/auth/me')
    .set('Origin', 'http://localhost:5173')
    .expect(401);
});
