import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PaginationDto } from '../common/pagination.dto.js';
import { select } from './dto.js';
@Injectable()
export class TurmasRepository {
  constructor(private readonly prisma: PrismaService) {}
  list({ page, limit }: PaginationDto, scope?: Prisma.turmaWhereInput) {
    return this.prisma.client.$transaction(async (tx) => ({
      data: await tx.turma.findMany({
        select,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
        ...(scope ? { where: scope } : {}),
      }),
      total: await (scope
        ? tx.turma.count({ where: scope })
        : tx.turma.count()),
    }));
  }
  findById(id: number, scope?: Prisma.turmaWhereInput) {
    return this.prisma.client.turma.findUnique({
      where: { id, ...(scope ? { AND: scope } : {}) },
      select,
    });
  }
  create(data: Prisma.turmaUncheckedCreateInput) {
    return this.prisma.client.$transaction(async (tx) => {
      return tx.turma.create({ data, select });
    });
  }
  update(
    id: number,
    data: Prisma.turmaUncheckedUpdateInput,
    scope?: Prisma.turmaWhereInput,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      const current = await tx.turma.findUnique({
        where: { id, ...(scope ? { AND: scope } : {}) },
        select,
      });
      if (!current) throw new NotFoundException('Registro nao encontrado.');
      return await tx.turma.update({
        where: { id, ...(scope ? { AND: scope } : {}) },
        data,
        select,
      });
    });
  }
  delete(id: number, scope?: Prisma.turmaWhereInput) {
    return this.prisma.client.turma.delete({
      where: { id, ...(scope ? { AND: scope } : {}) },
      select: { id: true },
    });
  }
}
