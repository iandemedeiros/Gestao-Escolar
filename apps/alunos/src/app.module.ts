import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AlunosModule } from './alunos/alunos.module.js';

@Module({
  imports: [PrismaModule, AlunosModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
