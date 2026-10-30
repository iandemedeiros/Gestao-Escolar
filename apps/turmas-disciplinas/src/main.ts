import './config/environment.js';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(
    process.env.TURMAS_DISCIPLINAS_PORT ?? process.env.PORT ?? 3003,
  );
}
await bootstrap();
