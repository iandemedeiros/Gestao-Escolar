import { Roles, Self } from '../auth/security.js';
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
@Controller('alunos')
@UseGuards(AlunosAccessGuard)
export class AlunosController {
  constructor(private readonly alunos: AlunosService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.alunos.list(query);
  }

  @Roles('SUPER_ADMIN', 'ALUNO')
  @Self('id', 'ALUNO')
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.alunos.findById(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.alunos.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.alunos.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string) {
    return this.alunos.delete(id);
  }
}
