import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ContatosRepository } from './contatos.repository.js';
import {
  createContatoSchema,
  updateContatoSchema,
  ContatoResponseDto,
} from './dto/contato.dto.js';
import {
  paginationSchema,
  type PaginatedDto,
} from '../common/pagination.dto.js';
import { validate, uuid } from '../common/validation.js';
import { databaseOperation } from '../common/database-errors.js';

function response(value: ContatoResponseDto): ContatoResponseDto {
  return { id: value.id, aluno_id: value.aluno_id };
}

@Injectable()
export class ContatosService {
  constructor(private readonly repository: ContatosRepository) {}

  async list(
    alunoId: string,
    query: unknown,
  ): Promise<PaginatedDto<ContatoResponseDto>> {
    uuid(alunoId);
    const pagination = validate(paginationSchema, query);
    const result = await databaseOperation(() =>
      this.repository.list(alunoId, pagination),
    );
    return {
      data: result.data.map(response),
      ...pagination,
      total: result.total,
    };
  }

  async create(alunoId: string, input: unknown): Promise<ContatoResponseDto> {
    uuid(alunoId);
    const data = validate(createContatoSchema, input);
    return response(
      await databaseOperation(() =>
        this.repository.create(alunoId, { ...data, id: randomUUID() }),
      ),
    );
  }

  async update(
    alunoId: string,
    contatoId: string,
    input: unknown,
  ): Promise<ContatoResponseDto> {
    uuid(alunoId);
    uuid(contatoId);
    const data = validate(updateContatoSchema, input);
    return response(
      await databaseOperation(() =>
        this.repository.update(alunoId, contatoId, data),
      ),
    );
  }

  async delete(alunoId: string, contatoId: string): Promise<void> {
    uuid(alunoId);
    uuid(contatoId);
    await databaseOperation(() => this.repository.delete(alunoId, contatoId));
  }
}
