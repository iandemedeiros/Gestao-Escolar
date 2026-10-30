import { Roles } from '../auth/security.js';
import { Req } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import {
  AcademicResource,
  academicScope,
  type AcademicRequest,
} from '../academic/academic.guard.js';
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
import { NotasService } from './notas.service.js';
@AcademicResource('nota')
@Roles('SUPER_ADMIN', 'PROFESSOR', 'ALUNO')
@Controller('notas')
@UseGuards(AccessGuard)
export class NotasController {
  constructor(private readonly service: NotasService) {}
  @Get()
  list(
    @Query()
    query: unknown,
    @Req()
    request: AcademicRequest,
  ) {
    return this.service.list(
      query,
      academicScope<Prisma.notaWhereInput>(request),
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
      academicScope<Prisma.notaWhereInput>(request),
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
      academicScope<Prisma.notaWhereInput>(request),
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
      academicScope<Prisma.notaWhereInput>(request),
    );
  }
}
