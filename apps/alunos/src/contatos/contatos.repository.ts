import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { PaginationDto } from '../common/pagination.dto.js';

const contatoSelect = {
  id: true,
  aluno_id: true,
} satisfies Prisma.contatoSelect;
@Injectable()
export class ContatosRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(alunoId: string, { page, limit }: PaginationDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const aluno = await tx.aluno.findUnique({
        where: { id: alunoId },
        select: { id: true },
      });
      if (!aluno) throw new NotFoundException('Aluno nao encontrado.');
      return {
        data: await tx.contato.findMany({
          where: { aluno_id: alunoId },
          select: contatoSelect,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { id: 'asc' },
        }),
        total: await tx.contato.count({ where: { aluno_id: alunoId } }),
      };
    });
  }

  create(
    alunoId: string,
    data: Omit<Prisma.contatoUncheckedCreateInput, 'aluno_id'>,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      const aluno = await tx.aluno.findUnique({
        where: { id: alunoId },
        select: { id: true },
      });
      if (!aluno) throw new NotFoundException('Aluno nao encontrado.');
      return tx.contato.create({
        data: { ...data, aluno_id: alunoId },
        select: contatoSelect,
      });
    });
  }

  update(alunoId: string, contatoId: string, data: Prisma.contatoUpdateInput) {
    // Scope the atomic mutation itself; a prior ownership check would race.
    return this.prisma.client.contato.update({
      where: { id: contatoId, aluno_id: alunoId },
      data,
      select: contatoSelect,
    });
  }

  delete(alunoId: string, contatoId: string) {
    return this.prisma.client.contato.delete({
      where: { id: contatoId, aluno_id: alunoId },
      select: { id: true },
    });
  }
}
