import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('turmas-disciplinas HTTP', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health returns JSON with the service identity and status', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect({ service: 'turmas-disciplinas', status: 'ok' });
  });
});
