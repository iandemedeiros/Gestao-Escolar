import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PaginationDto } from '../common/pagination.dto.js';
import { validate } from '../common/validation.js';
import { uuid } from '../common/fields.js';
import { select } from './dto.js';
@Injectable()
export class MensagensRepository {
  constructor(private readonly prisma: PrismaService) {}
  list({ page, limit }: PaginationDto) {
    return this.prisma.client.$transaction(async (tx) => ({
      data: await tx.mensagem.findMany({
        select,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      total: await tx.mensagem.count(),
    }));
  }
  findById(id: string) {
    return this.prisma.client.mensagem.findUnique({ where: { id }, select });
  }
  private async checkRelations(
    tx: Prisma.TransactionClient,
    data: { tipoId?: unknown },
  ) {
    if (data.tipoId !== undefined) {
      const parent = await tx.tipomensagem.findUnique({
        where: { id: validate(uuid, data.tipoId) },
        select: { id: true },
      });
      if (!parent)
        throw new NotFoundException('Referencia local nao encontrada.');
    }
  }
  create(data: Prisma.mensagemUncheckedCreateInput) {
    return this.prisma.client.$transaction(async (tx) => {
      await this.checkRelations(tx, data);
      return tx.mensagem.create({ data, select });
    });
  }
  update(id: string, data: Prisma.mensagemUncheckedUpdateInput) {
    return this.prisma.client.$transaction(async (tx) => {
      const current = await tx.mensagem.findUnique({ where: { id }, select });
      if (!current) throw new NotFoundException('Registro nao encontrado.');
      await this.checkRelations(tx, data);

      return await tx.mensagem.update({ where: { id }, data, select });
    });
  }
  delete(id: string) {
    return this.prisma.client.mensagem.delete({
      where: { id },
      select: { id: true },
    });
  }
}
