import type { Prisma } from '../generated/prisma/client.js';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service.js';
import { databaseOperation } from '../common/database-errors.js';
import { paginationSchema } from '../common/pagination.dto.js';
import { validate } from '../common/validation.js';
import { AcademicHttp } from './academic.http.js';
import type { AuthRequest } from '../auth/security.js';
import {
  createSchema as evaluationCreate,
  updateSchema as evaluationUpdate,
} from '../avaliacoes/dto.js';
import {
  createSchema as gradeCreate,
  updateSchema as gradeUpdate,
} from '../notas/dto.js';
export type Resource = 'avaliacao' | 'nota';

@Injectable()
export class AcademicPolicy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: AcademicHttp,
  ) {}
  private async current(resource: Resource, id: string) {
    if (resource === 'avaliacao') {
      const row = await databaseOperation(() =>
        this.prisma.client.avaliacao.findUnique({
          where: { id },
          select: { turma_id: true, disciplina_id: true, professor_id: true },
        }),
      );
      if (!row) throw new NotFoundException('Registro nao encontrado.');
      return {
        context: {
          turma_id: row.turma_id,
          disciplina_id: row.disciplina_id,
          professor_id: row.professor_id,
        },
      };
    }
    const row = await databaseOperation(() =>
      this.prisma.client.nota.findUnique({
        where: { id },
        select: {
          aluno_id: true,
          avaliacao_id: true,
          avaliacao: {
            select: { turma_id: true, disciplina_id: true, professor_id: true },
          },
        },
      }),
    );
    if (!row) throw new NotFoundException('Registro nao encontrado.');
    if (!row.avaliacao)
      throw new ServiceUnavailableException('Contexto academico indisponivel.');
    return {
      context: {
        turma_id: row.avaliacao.turma_id,
        disciplina_id: row.avaliacao.disciplina_id,
        professor_id: row.avaliacao.professor_id,
      },
      aluno_id: row.aluno_id,
      avaliacao_id: row.avaliacao_id,
    };
  }
  async authorize(resource: Resource, request: AuthRequest): Promise<unknown> {
    const user = request.user,
      read = ['GET', 'HEAD'].includes(request.method),
      bearer = request.headers.authorization!;
    if (
      !read &&
      (user.role === 'ALUNO' ||
        (user.role === 'PROFESSOR' && request.method === 'DELETE'))
    )
      throw new ForbiddenException();
    const id = request.params.id
      ? validate(z.uuid(), request.params.id)
      : undefined;
    if (read) {
      validate(paginationSchema, id ? {} : request.query);
      if (user.role === 'SUPER_ADMIN') return {};
      if (id) {
        const row = await this.current(resource, id);
        if (user.role === 'ALUNO' && row.aluno_id && row.aluno_id !== user.sub)
          throw new ForbiddenException();
        if (user.role === 'PROFESSOR' && row.context.professor_id !== user.sub)
          throw new ForbiddenException();
        await this.http.context(
          {
            ...row.context,
            ...(user.role === 'ALUNO'
              ? { aluno_id: user.sub }
              : row.aluno_id
                ? { aluno_id: row.aluno_id }
                : {}),
          },
          bearer,
        );
        return resource === 'avaliacao'
          ? { ...row.context }
          : { aluno_id: row.aluno_id, avaliacao_id: row.avaliacao_id };
      }
      const scope = await this.http.scope(bearer);
      const evaluation = {
        OR: scope.contexts,
        ...(user.role === 'PROFESSOR' ? { professor_id: user.sub } : {}),
      } satisfies Prisma.avaliacaoWhereInput;
      return resource === 'avaliacao'
        ? evaluation
        : {
            ...(user.role === 'ALUNO' ? { aluno_id: user.sub } : {}),
            avaliacao: evaluation,
          };
    }
    if (request.method === 'DELETE') return {};
    if (resource === 'avaliacao') {
      if (request.method === 'POST') {
        if (
          user.role === 'PROFESSOR' &&
          request.body &&
          typeof request.body === 'object' &&
          !Array.isArray(request.body)
        ) {
          if (
            request.body.professor_id &&
            request.body.professor_id !== user.sub
          )
            throw new ForbiddenException();
          request.body = { ...request.body, professor_id: user.sub };
        }
        const dto = validate(evaluationCreate, request.body);
        await this.http.exists('professores', dto.professor_id, bearer);
        await this.http.context(dto, bearer);
        return {};
      }
      const dto = validate(evaluationUpdate, request.body);
      const current = await this.current(resource, id!);
      if (
        user.role === 'PROFESSOR' &&
        current.context.professor_id !== user.sub
      )
        throw new ForbiddenException();
      for (const key of ['turma_id', 'disciplina_id', 'professor_id'] as const)
        if (dto[key] !== undefined && dto[key] !== current.context[key])
          throw new ConflictException('Contexto academico imutavel.');
      await this.http.context(current.context, bearer);
      return { ...current.context };
    }
    if (request.method === 'POST') {
      const dto = validate(gradeCreate, request.body);
      const evaluation = await this.current('avaliacao', dto.avaliacao_id);
      if (
        user.role === 'PROFESSOR' &&
        evaluation.context.professor_id !== user.sub
      )
        throw new ForbiddenException();
      await this.http.exists('alunos', dto.aluno_id, bearer);
      await this.http.exists(
        'professores',
        evaluation.context.professor_id,
        bearer,
      );
      await this.http.context(
        { ...evaluation.context, aluno_id: dto.aluno_id },
        bearer,
      );
      return {};
    }
    const dto = validate(gradeUpdate, request.body);
    const current = await this.current(resource, id!);
    if (user.role === 'PROFESSOR' && current.context.professor_id !== user.sub)
      throw new ForbiddenException();
    if (
      (dto.avaliacao_id && dto.avaliacao_id !== current.avaliacao_id) ||
      (dto.aluno_id && dto.aluno_id !== current.aluno_id)
    )
      throw new ConflictException('Contexto academico imutavel.');
    await this.http.context(
      { ...current.context, aluno_id: current.aluno_id },
      bearer,
    );
    return {
      avaliacao_id: current.avaliacao_id,
      aluno_id: current.aluno_id,
      avaliacao: { ...current.context },
    };
  }
}
