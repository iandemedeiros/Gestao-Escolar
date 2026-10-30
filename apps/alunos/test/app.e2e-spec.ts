import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('alunos HTTP', () => {
  let app: INestApplication;
  let connectionAttempts: number;

  beforeEach(async () => {
    vi.stubEnv(
      'DATABASE_URL',
      'mysql://placeholder:placeholder@127.0.0.1:1/offline',
    );
    connectionAttempts = 0;
    vi.spyOn(PrismaMariaDb.prototype, 'connect').mockImplementation(async () => {
      connectionAttempts++;
      throw new Error('Simulated offline database');
    });
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    try {
      await app.close();
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    }
  });

  it('GET /health returns JSON with the service identity and status', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect({ service: 'alunos', status: 'ok' });
    expect(connectionAttempts).toBe(0);
  });
});
