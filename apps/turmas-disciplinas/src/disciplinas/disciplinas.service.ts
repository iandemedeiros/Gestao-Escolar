import type { Prisma } from '../generated/prisma/client.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { validate } from '../common/validation.js';
import { uuid } from '../common/fields.js';
import { paginationSchema } from '../common/pagination.dto.js';
import { databaseOperation } from '../common/database-errors.js';
import { createSchema, updateSchema, toResponse } from './dto.js';
import { DisciplinasRepository } from './disciplinas.repository.js';
@Injectable()
export class DisciplinasService {
  constructor(private readonly repository: DisciplinasRepository) {}
  private id(value: unknown) {
    return validate(uuid, value);
  }
  async list(query: unknown, scope?: Prisma.disciplinaWhereInput) {
    const pagination = validate(paginationSchema, query);
    const result = await databaseOperation(() =>
      this.repository.list(pagination, scope),
    );
    return {
      data: result.data.map(toResponse),
      ...pagination,
      total: result.total,
    };
  }
  async findById(value: string, scope?: Prisma.disciplinaWhereInput) {
    const id = this.id(value);
    const result = await databaseOperation(() =>
      this.repository.findById(id, scope),
    );
    if (!result) throw new NotFoundException('Registro nao encontrado.');
    return toResponse(result);
  }
  async create(body: unknown) {
    const data = validate(createSchema, body);
    const input = { ...data, id: randomUUID() };
    return toResponse(
      await databaseOperation(() => this.repository.create(input)),
    );
  }
  async update(
    value: string,
    body: unknown,
    scope?: Prisma.disciplinaWhereInput,
  ) {
    const id = this.id(value);
    const data = validate(updateSchema, body);
    const input = data;
    return toResponse(
      await databaseOperation(() => this.repository.update(id, input, scope)),
    );
  }
  async delete(
    value: string,
    scope?: Prisma.disciplinaWhereInput,
  ): Promise<void> {
    const id = this.id(value);
    await databaseOperation(() => this.repository.delete(id, scope));
  }
}
