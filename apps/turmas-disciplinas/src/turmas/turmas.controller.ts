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
import { AccessGuard } from '../common/access.guard.js';
import { TurmasService } from './turmas.service.js';
@Roles('SUPER_ADMIN', 'PROFESSOR', 'ALUNO')
@AcademicResource('turma')
@Controller('turmas')
@UseGuards(AccessGuard)
export class TurmasController {
  constructor(private readonly service: TurmasService) {}
  @Get()
  list(
    @Query()
    query: unknown,
    @Req()
    request: AcademicRequest,
  ) {
    return this.service.list(
      query,
      academicScope<Prisma.turmaWhereInput>(request),
    );
  }
  @Get(':id')
  findById(
    @Param('id')
    id: string,
    @Req()
    request: AcademicRequest,
  ) {
    return this.service.findById(
      id,
      academicScope<Prisma.turmaWhereInput>(request),
    );
  }
  @Post()
  create(
    @Body()
    body: unknown,
  ) {
    return this.service.create(body);
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
    return this.service.update(
      id,
      body,
      academicScope<Prisma.turmaWhereInput>(request),
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
    return this.service.delete(
      id,
      academicScope<Prisma.turmaWhereInput>(request),
    );
  }
}
