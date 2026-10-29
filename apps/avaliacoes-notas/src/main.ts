import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(
    process.env.AVALIACOES_NOTAS_PORT ?? process.env.PORT ?? 3004,
  );
}
await bootstrap();
