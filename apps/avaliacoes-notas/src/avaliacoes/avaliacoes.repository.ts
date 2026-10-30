import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PaginationDto } from '../common/pagination.dto.js';

import { select, type Selected } from './dto.js';
@Injectable()
export class AvaliacoesRepository {
  constructor(private readonly prisma: PrismaService) {}
  list({ page, limit }: PaginationDto) {
    return this.prisma.client.$transaction(async (tx) => ({
      data: await tx.avaliacao.findMany({
        select,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      total: await tx.avaliacao.count(),
    }));
  }
  findById(id: string) {
    return this.prisma.client.avaliacao.findUnique({ where: { id }, select });
  }

  create(data: Prisma.avaliacaoUncheckedCreateInput) {
    return this.prisma.client.$transaction(async (tx) => {
      return tx.avaliacao.create({ data, select });
    });
  }
  update(
    id: string,
    data: Prisma.avaliacaoUncheckedUpdateInput,
    check: (current: Selected) => void,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      const current = await tx.avaliacao.findUnique({ where: { id }, select });
      if (!current) throw new NotFoundException('Registro nao encontrado.');

      check(current);
      try {
        return await tx.avaliacao.update({
          where: {
            id,
            data_realizacao: current.data_realizacao,
            data_entrega_final: current.data_entrega_final,
          },
          data,
          select,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        )
          throw new ConflictException('Registro alterado concorrentemente.');
        throw error;
      }
    });
  }
  delete(id: string) {
    return this.prisma.client.avaliacao.delete({
      where: { id },
      select: { id: true },
    });
  }
}
