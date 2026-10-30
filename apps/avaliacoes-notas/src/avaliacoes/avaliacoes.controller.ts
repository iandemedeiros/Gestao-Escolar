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
import { AvaliacoesService } from './avaliacoes.service.js';
@AcademicResource('avaliacao')
@Roles('SUPER_ADMIN', 'PROFESSOR', 'ALUNO')
@Controller('avaliacoes')
@UseGuards(AccessGuard)
export class AvaliacoesController {
  constructor(private readonly service: AvaliacoesService) {}
  @Get()
  list(
    @Query()
    query: unknown,
    @Req()
    request: AcademicRequest,
  ) {
    return this.service
      .list(query, academicScope<Prisma.avaliacaoWhereInput>(request))
      .then((result) =>
        request.user?.role === 'ALUNO'
          ? {
              ...result,
              data: result.data.map(
                ({ entrega_do_aluno: _delivery, ...value }) => value,
              ),
            }
          : result,
      );
  }
  @Get(':id')
  findById(
    @Param('id')
    id: string,
    @Req()
    request: AcademicRequest,
  ) {
    return this.service
      .findById(id, academicScope<Prisma.avaliacaoWhereInput>(request))
      .then((result) => {
        if (request.user?.role !== 'ALUNO') return result;
        const { entrega_do_aluno: _delivery, ...value } = result;
        return value;
      });
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
      academicScope<Prisma.avaliacaoWhereInput>(request),
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
      academicScope<Prisma.avaliacaoWhereInput>(request),
    );
  }
}
