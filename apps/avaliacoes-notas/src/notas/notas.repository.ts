import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PaginationDto } from '../common/pagination.dto.js';
import { validate } from '../common/validation.js';
import { uuid } from '../common/fields.js';
import { select } from './dto.js';
@Injectable()
export class NotasRepository {
  constructor(private readonly prisma: PrismaService) {}
  list({ page, limit }: PaginationDto) {
    return this.prisma.client.$transaction(async (tx) => ({
      data: await tx.nota.findMany({
        select,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      total: await tx.nota.count(),
    }));
  }
  findById(id: string) {
    return this.prisma.client.nota.findUnique({ where: { id }, select });
  }
  private async checkRelations(
    tx: Prisma.TransactionClient,
    data: { avaliacao_id?: unknown },
  ) {
    if (data.avaliacao_id !== undefined) {
      const parent = await tx.avaliacao.findUnique({
        where: { id: validate(uuid, data.avaliacao_id) },
        select: { id: true },
      });
      if (!parent)
        throw new NotFoundException('Referencia local nao encontrada.');
    }
  }
  create(data: Prisma.notaUncheckedCreateInput) {
    return this.prisma.client.$transaction(async (tx) => {
      await this.checkRelations(tx, data);
      return tx.nota.create({ data, select });
    });
  }
  update(id: string, data: Prisma.notaUncheckedUpdateInput) {
    return this.prisma.client.$transaction(async (tx) => {
      const current = await tx.nota.findUnique({ where: { id }, select });
      if (!current) throw new NotFoundException('Registro nao encontrado.');
      await this.checkRelations(tx, data);

      return await tx.nota.update({ where: { id }, data, select });
    });
  }
  delete(id: string) {
    return this.prisma.client.nota.delete({
      where: { id },
      select: { id: true },
    });
  }
}
