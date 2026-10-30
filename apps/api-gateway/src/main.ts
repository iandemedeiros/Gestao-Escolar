import './config/environment.js';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureFrontend } from './openapi/setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureFrontend(app);
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
