import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PaginationDto } from '../common/pagination.dto.js';

import { select } from './dto.js';
@Injectable()
export class TiposMensagemRepository {
  constructor(private readonly prisma: PrismaService) {}
  list({ page, limit }: PaginationDto) {
    return this.prisma.client.$transaction(async (tx) => ({
      data: await tx.tipomensagem.findMany({
        select,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      total: await tx.tipomensagem.count(),
    }));
  }
  findById(id: string) {
    return this.prisma.client.tipomensagem.findUnique({
      where: { id },
      select,
    });
  }

  create(data: Prisma.tipomensagemUncheckedCreateInput) {
    return this.prisma.client.$transaction(async (tx) => {
      return tx.tipomensagem.create({ data, select });
    });
  }
  update(id: string, data: Prisma.tipomensagemUncheckedUpdateInput) {
    return this.prisma.client.$transaction(async (tx) => {
      const current = await tx.tipomensagem.findUnique({
        where: { id },
        select,
      });
      if (!current) throw new NotFoundException('Registro nao encontrado.');

      return await tx.tipomensagem.update({ where: { id }, data, select });
    });
  }
  delete(id: string) {
    return this.prisma.client.tipomensagem.delete({
      where: { id },
      select: { id: true },
    });
  }
}
