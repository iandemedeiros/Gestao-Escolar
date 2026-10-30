import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AlunosAccessGuard } from '../alunos/alunos-access.guard.js';
import { ContatosController } from './contatos.controller.js';
import { ContatosService } from './contatos.service.js';
import { ContatosRepository } from './contatos.repository.js';

@Module({
  imports: [PrismaModule],
  controllers: [ContatosController],
  providers: [ContatosService, ContatosRepository, AlunosAccessGuard],
})
export class ContatosModule {}
