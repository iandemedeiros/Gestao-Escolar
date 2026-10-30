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
import { AlunosAccessGuard } from '../alunos/alunos-access.guard.js';
import { ContatosService } from './contatos.service.js';

@Controller('alunos/:alunoId/contatos')
@UseGuards(AlunosAccessGuard)
export class ContatosController {
  constructor(private readonly contatos: ContatosService) {}

  @Get()
  list(@Param('alunoId') alunoId: string, @Query() query: unknown) {
    return this.contatos.list(alunoId, query);
  }

  @Post()
  create(@Param('alunoId') alunoId: string, @Body() body: unknown) {
    return this.contatos.create(alunoId, body);
  }

  @Patch(':contatoId')
  update(
    @Param('alunoId') alunoId: string,
    @Param('contatoId') contatoId: string,
    @Body() body: unknown,
  ) {
    return this.contatos.update(alunoId, contatoId, body);
  }

  @Delete(':contatoId')
  @HttpCode(204)
  delete(
    @Param('alunoId') alunoId: string,
    @Param('contatoId') contatoId: string,
  ) {
    return this.contatos.delete(alunoId, contatoId);
  }
}
