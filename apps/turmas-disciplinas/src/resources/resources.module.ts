import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AccessGuard } from '../common/access.guard.js';
import { TurmasController } from '../turmas/turmas.controller.js';
import { TurmasRepository } from '../turmas/turmas.repository.js';
import { TurmasService } from '../turmas/turmas.service.js';
import { DisciplinasController } from '../disciplinas/disciplinas.controller.js';
import { DisciplinasRepository } from '../disciplinas/disciplinas.repository.js';
import { DisciplinasService } from '../disciplinas/disciplinas.service.js';
import { AlocacoesAlunosController } from '../alocacoes-alunos/alocacoes-alunos.controller.js';
import { AlocacoesAlunosRepository } from '../alocacoes-alunos/alocacoes-alunos.repository.js';
import { AlocacoesAlunosService } from '../alocacoes-alunos/alocacoes-alunos.service.js';
import { AlocacoesProfessoresController } from '../alocacoes-professores/alocacoes-professores.controller.js';
import { AlocacoesProfessoresRepository } from '../alocacoes-professores/alocacoes-professores.repository.js';
import { AlocacoesProfessoresService } from '../alocacoes-professores/alocacoes-professores.service.js';
@Module({
  imports: [PrismaModule],
  controllers: [
    TurmasController,
    DisciplinasController,
    AlocacoesAlunosController,
    AlocacoesProfessoresController,
  ],
  providers: [
    AccessGuard,
    TurmasRepository,
    TurmasService,
    DisciplinasRepository,
    DisciplinasService,
    AlocacoesAlunosRepository,
    AlocacoesAlunosService,
    AlocacoesProfessoresRepository,
    AlocacoesProfessoresService,
  ],
})
export class ResourcesModule {}
