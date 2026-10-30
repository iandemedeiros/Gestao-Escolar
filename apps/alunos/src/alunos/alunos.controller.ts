import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AlunosAccessGuard } from './alunos-access.guard.js';
import { AlunosService } from './alunos.service.js';
import { AlunoResponseDto } from './dto/aluno-response.dto.js';

@Controller('alunos')
@UseGuards(AlunosAccessGuard)
export class AlunosController {
  constructor(private readonly alunos: AlunosService) {}

  @Get()
  disabled(): never {
    throw new ForbiddenException('Consulta de alunos desabilitada.');
  }

  @Get(':id')
  findById(@Param('id') id: string): Promise<AlunoResponseDto> {
    return this.alunos.findById(id);
  }
}
