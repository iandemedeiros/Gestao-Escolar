import { Req } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import {
  AcademicResource,
  academicScope,
  type AcademicRequest,
} from '../academic/academic.guard.js';
import { Roles } from '../auth/security.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AlunosAccessGuard } from './alunos-access.guard.js';
import { AlunosService } from './alunos.service.js';
@Roles('SUPER_ADMIN')
@AcademicResource('aluno')
@Controller('alunos')
@UseGuards(AlunosAccessGuard)
export class AlunosController {
  constructor(private readonly alunos: AlunosService) {}
  @Roles('SUPER_ADMIN', 'PROFESSOR')
  @Get()
  list(
    @Query()
    query: unknown,
    @Req()
    request: AcademicRequest,
  ) {
    return this.alunos
      .list(query, academicScope<Prisma.alunoWhereInput>(request))
      .then((result) =>
        request.user?.role === 'PROFESSOR'
          ? {
              ...result,
              data: result.data.map((value) => ({
                id: value.id,
                nome: value.nome,
              })),
            }
          : result,
      );
  }
  @Roles('SUPER_ADMIN', 'PROFESSOR', 'ALUNO')
  @Get(':id')
  findById(
    @Param('id')
    id: string,
    @Req()
    request: AcademicRequest,
  ) {
    return this.alunos
      .findById(id, academicScope<Prisma.alunoWhereInput>(request))
      .then((value) =>
        request.user?.role === 'PROFESSOR'
          ? { id: value.id, nome: value.nome }
          : value,
      );
  }
  @Post()
  create(
    @Body()
    body: unknown,
  ) {
    return this.alunos.create(body);
  }
  @Patch(':id')
  update(
    @Param('id')
    id: string,
    @Body()
    body: unknown,
    @Req()
    request: AcademicRequest,
  ) {
    return this.alunos.update(
      id,
      body,
      academicScope<Prisma.alunoWhereInput>(request),
    );
  }
  @Delete(':id')
  @HttpCode(204)
  delete(
    @Param('id')
    id: string,
    @Req()
    request: AcademicRequest,
  ) {
    return this.alunos.delete(
      id,
      academicScope<Prisma.alunoWhereInput>(request),
    );
  }
}
