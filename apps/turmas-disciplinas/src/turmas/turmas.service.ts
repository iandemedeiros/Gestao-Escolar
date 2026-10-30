import type { Prisma } from '../generated/prisma/client.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { validate } from '../common/validation.js';
import { positiveInt } from '../common/fields.js';
import { z } from 'zod';
import { paginationSchema } from '../common/pagination.dto.js';
import { databaseOperation } from '../common/database-errors.js';
import { createSchema, updateSchema, toResponse } from './dto.js';
import { TurmasRepository } from './turmas.repository.js';
@Injectable()
export class TurmasService {
  constructor(private readonly repository: TurmasRepository) {}
  private id(value: unknown) {
    return validate(
      z
        .string()
        .regex(/^[1-9][0-9]*$/)
        .transform(Number)
        .pipe(positiveInt),
      value,
    );
  }
  async list(query: unknown, scope?: Prisma.turmaWhereInput) {
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
  async findById(value: string, scope?: Prisma.turmaWhereInput) {
    const id = this.id(value);
    const result = await databaseOperation(() =>
      this.repository.findById(id, scope),
    );
    if (!result) throw new NotFoundException('Registro nao encontrado.');
    return toResponse(result);
  }
  async create(body: unknown) {
    const data = validate(createSchema, body);
    const input = { ...data };
    return toResponse(
      await databaseOperation(() => this.repository.create(input)),
    );
  }
  async update(value: string, body: unknown, scope?: Prisma.turmaWhereInput) {
    const id = this.id(value);
    const data = validate(updateSchema, body);
    const input = data;
    return toResponse(
      await databaseOperation(() => this.repository.update(id, input, scope)),
    );
  }
  async delete(value: string, scope?: Prisma.turmaWhereInput): Promise<void> {
    const id = this.id(value);
    await databaseOperation(() => this.repository.delete(id, scope));
  }
}
