import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { validate } from '../common/validation.js';
import { uuid } from '../common/fields.js';
import { paginationSchema } from '../common/pagination.dto.js';
import { databaseOperation } from '../common/database-errors.js';
import { createSchema, updateSchema, toResponse } from './dto.js';
import { MensagensRepository } from './mensagens.repository.js';
// External IDs are validated by DTO format only. Existence and authorization
// will be checked when inter-service integration is implemented.
@Injectable()
export class MensagensService {
  constructor(private readonly repository: MensagensRepository) {}
  private id(value: unknown) {
    return validate(uuid, value);
  }
  async list(query: unknown) {
    const pagination = validate(paginationSchema, query);
    const result = await databaseOperation(() =>
      this.repository.list(pagination),
    );
    return {
      data: result.data.map(toResponse),
      ...pagination,
      total: result.total,
    };
  }
  async findById(value: string) {
    const id = this.id(value);
    const result = await databaseOperation(() => this.repository.findById(id));
    if (!result) throw new NotFoundException('Registro nao encontrado.');
    return toResponse(result);
  }
  async create(body: unknown) {
    const data = validate(createSchema, body);
    const input = {
      ...data,
      id: randomUUID(),
      dataEnvio: new Date(Math.floor(Date.now() / 1000) * 1000),
    };
    return toResponse(
      await databaseOperation(() => this.repository.create(input)),
    );
  }
  async update(value: string, body: unknown) {
    const id = this.id(value);
    const data = validate(updateSchema, body);
    const input = data;
    return toResponse(
      await databaseOperation(() => this.repository.update(id, input)),
    );
  }
  async delete(value: string): Promise<void> {
    const id = this.id(value);
    await databaseOperation(() => this.repository.delete(id));
  }
}
