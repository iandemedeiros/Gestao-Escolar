import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AccessGuard } from '../common/access.guard.js';
import { PasswordHasher } from '../common/password-hasher.service.js';
import { ProfessoresController } from '../professores/professores.controller.js';
import { ProfessoresRepository } from '../professores/professores.repository.js';
import { ProfessoresService } from '../professores/professores.service.js';
import { ContatosController } from '../contatos/contatos.controller.js';
import { ContatosRepository } from '../contatos/contatos.repository.js';
import { ContatosService } from '../contatos/contatos.service.js';
import { DisponibilidadesController } from '../disponibilidades/disponibilidades.controller.js';
import { DisponibilidadesRepository } from '../disponibilidades/disponibilidades.repository.js';
import { DisponibilidadesService } from '../disponibilidades/disponibilidades.service.js';
@Module({
  imports: [PrismaModule],
  controllers: [
    ProfessoresController,
    ContatosController,
    DisponibilidadesController,
  ],
  providers: [
    AccessGuard,
    PasswordHasher,
    ProfessoresRepository,
    ProfessoresService,
    ContatosRepository,
    ContatosService,
    DisponibilidadesRepository,
    DisponibilidadesService,
  ],
})
export class ResourcesModule {}
