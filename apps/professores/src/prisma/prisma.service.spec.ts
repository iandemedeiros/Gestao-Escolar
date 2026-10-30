import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaService } from './prisma.service.js';

describe('PrismaService offline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('starts and shuts down without configuration or connection', async () => {
    vi.stubEnv('DATABASE_URL', undefined);
    const connect = vi.spyOn(PrismaMariaDb.prototype, 'connect');
    const service = new PrismaService();
    await service.onModuleDestroy();
    expect(connect).not.toHaveBeenCalled();
    expect(() => service.client).toThrow('DATABASE_URL não configurada');
  });

  it('creates one client lazily and disconnects it without opening a connection', async () => {
    vi.stubEnv(
      'DATABASE_URL',
      'mysql://placeholder:placeholder@127.0.0.1:1/offline',
    );
    const connect = vi.spyOn(PrismaMariaDb.prototype, 'connect');
    const service = new PrismaService();
    const client = service.client;
    const disconnect = vi.spyOn(client, '$disconnect');
    expect(service.client).toBe(client);
    await service.onModuleDestroy();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(connect).not.toHaveBeenCalled();
  });

  it('does not expose invalid connection configuration', () => {
    vi.stubEnv('DATABASE_URL', 'invalid-private-value');
    expect(() => new PrismaService().client).toThrow(
      'Configuração MySQL inválida para a API professores.',
    );
  });
});
