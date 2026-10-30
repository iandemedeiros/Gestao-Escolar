import type { Prisma } from '../generated/prisma/client.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AlunosRepository } from './alunos.repository.js';
import { PasswordHasher } from './password-hasher.service.js';
import { AlunoResponseDto } from './dto/aluno-response.dto.js';
import { createAlunoSchema, updateAlunoSchema } from './dto/aluno-input.dto.js';
import {
  paginationSchema,
  type PaginatedDto,
} from '../common/pagination.dto.js';
import { validate, uuid } from '../common/validation.js';
import { databaseOperation } from '../common/database-errors.js';
type SelectedAluno = {
  id: string;
  nome: string;
  data_nascimento: Date;
};
function response(aluno: SelectedAluno): AlunoResponseDto {
  return {
    id: aluno.id,
    nome: aluno.nome,
    data_nascimento: aluno.data_nascimento.toISOString().slice(0, 10),
  };
}
@Injectable()
export class AlunosService {
  constructor(
    private readonly repository: AlunosRepository,
    private readonly passwords: PasswordHasher,
  ) {}
  async list(
    query: unknown,
    scope?: Prisma.alunoWhereInput,
  ): Promise<PaginatedDto<AlunoResponseDto>> {
    const pagination = validate(paginationSchema, query);
    const result = await databaseOperation(() =>
      this.repository.list(pagination, scope),
    );
    return {
      data: result.data.map(response),
      ...pagination,
      total: result.total,
    };
  }
  async findById(
    id: string,
    scope?: Prisma.alunoWhereInput,
  ): Promise<AlunoResponseDto> {
    uuid(id);
    const aluno = await databaseOperation(() =>
      this.repository.findById(id, scope),
    );
    if (!aluno) throw new NotFoundException('Aluno nao encontrado.');
    return response(aluno);
  }
  async create(input: unknown): Promise<AlunoResponseDto> {
    const { senha, ...fields } = validate(createAlunoSchema, input);
    const senha_hash = await this.passwords.hash(senha);
    return response(
      await databaseOperation(() =>
        this.repository.create({
          ...fields,
          id: randomUUID(),
          senha_hash,
        }),
      ),
    );
  }
  async update(
    id: string,
    input: unknown,
    scope?: Prisma.alunoWhereInput,
  ): Promise<AlunoResponseDto> {
    uuid(id);
    const { senha, ...fields } = validate(updateAlunoSchema, input);
    const data = {
      ...fields,
      ...(senha !== undefined
        ? { senha_hash: await this.passwords.hash(senha) }
        : {}),
    };
    return response(
      await databaseOperation(() => this.repository.update(id, data, scope)),
    );
  }
  async delete(id: string, scope?: Prisma.alunoWhereInput): Promise<void> {
    uuid(id);
    await databaseOperation(() => this.repository.delete(id, scope));
  }
}
