import { Test } from '@nestjs/testing';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('turmas-disciplinas persistence offline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each([undefined, 'mysql://placeholder:placeholder@127.0.0.1:1/offline'])(
    'keeps health available without a database connection',
    async (url) => {
      vi.stubEnv('DATABASE_URL', url);
      const connect = vi
        .spyOn(PrismaMariaDb.prototype, 'connect')
        .mockRejectedValue(new Error('Offline database'));
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const app = module.createNestApplication();
      try {
        await app.init();
        expect(app.get(PrismaService)).toBeInstanceOf(PrismaService);
        await request(app.getHttpServer())
          .get('/health')
          .expect(200)
          .expect({ service: 'turmas-disciplinas', status: 'ok' });
      } finally {
        await app.close();
      }
      expect(connect).not.toHaveBeenCalled();
    },
  );
});
