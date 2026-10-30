import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private instance?: PrismaClient;

  // Construct lazily: application startup and /health require no database.
  // Prisma opens the connection on the first query or explicit $connect().
  get client(): PrismaClient {
    if (!this.instance) {
      const url = process.env.DATABASE_URL;
      if (!url) {
        throw new Error(
          'DATABASE_URL não configurada para a API avaliacoes-notas.',
        );
      }
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'mysql:' || parsed.pathname.length <= 1) {
          throw new Error('Invalid MySQL URL');
        }
        this.instance = new PrismaClient({
          adapter: new PrismaMariaDb(url),
          log: [],
          errorFormat: 'minimal',
        });
      } catch {
        // Never include credentials or the original configuration error.
        throw new Error(
          'Configuração MySQL inválida para a API avaliacoes-notas.',
        );
      }
    }
    return this.instance;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.instance) {
      try {
        await this.instance.$disconnect();
      } catch {
        throw new Error(
          'Não foi possível encerrar a conexão da API avaliacoes-notas.',
        );
      } finally {
        this.instance = undefined;
      }
    }
  }
}
