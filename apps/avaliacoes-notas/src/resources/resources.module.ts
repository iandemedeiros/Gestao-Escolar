import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AccessGuard } from '../common/access.guard.js';
import { AvaliacoesController } from '../avaliacoes/avaliacoes.controller.js';
import { AvaliacoesRepository } from '../avaliacoes/avaliacoes.repository.js';
import { AvaliacoesService } from '../avaliacoes/avaliacoes.service.js';
import { NotasController } from '../notas/notas.controller.js';
import { NotasRepository } from '../notas/notas.repository.js';
import { NotasService } from '../notas/notas.service.js';
@Module({
  imports: [PrismaModule],
  controllers: [AvaliacoesController, NotasController],
  providers: [
    AccessGuard,
    AvaliacoesRepository,
    AvaliacoesService,
    NotasRepository,
    NotasService,
  ],
})
export class ResourcesModule {}
