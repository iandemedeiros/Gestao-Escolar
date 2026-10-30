import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AccessGuard } from '../common/access.guard.js';
import { MensagensController } from '../mensagens/mensagens.controller.js';
import { MensagensRepository } from '../mensagens/mensagens.repository.js';
import { MensagensService } from '../mensagens/mensagens.service.js';
import { TiposMensagemController } from '../tipos-mensagem/tipos-mensagem.controller.js';
import { TiposMensagemRepository } from '../tipos-mensagem/tipos-mensagem.repository.js';
import { TiposMensagemService } from '../tipos-mensagem/tipos-mensagem.service.js';
@Module({
  imports: [PrismaModule],
  controllers: [MensagensController, TiposMensagemController],
  providers: [
    AccessGuard,
    MensagensRepository,
    MensagensService,
    TiposMensagemRepository,
    TiposMensagemService,
  ],
})
export class ResourcesModule {}
