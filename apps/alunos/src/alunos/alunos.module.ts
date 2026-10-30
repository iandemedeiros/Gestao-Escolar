import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AlunosController } from './alunos.controller.js';
import { AlunosService } from './alunos.service.js';
import { AlunosRepository } from './alunos.repository.js';
import { AlunosAccessGuard } from './alunos-access.guard.js';
import { PasswordHasher } from './password-hasher.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AlunosController],
  providers: [
    AlunosService,
    AlunosRepository,
    AlunosAccessGuard,
    PasswordHasher,
  ],
})
export class AlunosModule {}
