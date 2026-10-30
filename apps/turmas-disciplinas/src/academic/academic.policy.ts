import type { Prisma } from '../generated/prisma/client.js';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service.js';
import { databaseOperation } from '../common/database-errors.js';
import { validate } from '../common/validation.js';
import { paginationSchema } from '../common/pagination.dto.js';
import { AcademicHttp } from './academic.http.js';
import type { AuthRequest, Principal } from '../auth/security.js';
import {
  createSchema as alunoCreate,
  updateSchema as alunoUpdate,
} from '../alocacoes-alunos/dto.js';
import {
  createSchema as professorCreate,
  updateSchema as professorUpdate,
} from '../alocacoes-professores/dto.js';
export type Resource =
  'turma' | 'disciplina' | 'alocacao_aluno' | 'alocacao_professor';
export const contextSchema = z.strictObject({
  turma_id: z.number().int().min(1).max(2147483647),
  disciplina_id: z.uuid(),
  professor_id: z.uuid().optional(),
  aluno_id: z.uuid().optional(),
});
@Injectable()
export class AcademicPolicy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: AcademicHttp,
  ) {}
  where(resource: Resource, user: Principal): unknown {
    if (user.role === 'SUPER_ADMIN') return {};
    const teacher = {
      alocacao_professor: { some: { professor_id: user.sub } },
    } satisfies Prisma.disciplinaWhereInput;
    if (resource === 'alocacao_professor') {
      if (user.role !== 'PROFESSOR') throw new ForbiddenException();
      return {
        professor_id: user.sub,
      } satisfies Prisma.alocacao_professorWhereInput;
    }
    if (resource === 'alocacao_aluno')
      return user.role === 'ALUNO'
        ? ({ aluno_id: user.sub } satisfies Prisma.alocacao_alunoWhereInput)
        : ({ disciplina: teacher } satisfies Prisma.alocacao_alunoWhereInput);
    if (resource === 'disciplina')
      return user.role === 'ALUNO'
        ? ({
            alocacao_aluno: { some: { aluno_id: user.sub } },
          } satisfies Prisma.disciplinaWhereInput)
        : teacher;
    return {
      alocacao_aluno: {
        some:
          user.role === 'ALUNO'
            ? { aluno_id: user.sub }
            : { disciplina: teacher },
      },
    } satisfies Prisma.turmaWhereInput;
  }
  async authorize(resource: Resource, request: AuthRequest): Promise<unknown> {
    const read = ['GET', 'HEAD'].includes(request.method),
      user = request.user;
    if (!read && user.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    if (read)
      validate(paginationSchema, request.params.id ? {} : request.query);
    if (request.params.id)
      validate<unknown>(
        resource === 'turma'
          ? z
              .string()
              .regex(/^[1-9][0-9]*$/)
              .transform(Number)
              .pipe(z.number().int().max(2147483647))
          : z.uuid(),
        request.params.id,
      );
    if (!read && ['POST', 'PATCH'].includes(request.method)) {
      if (resource === 'alocacao_aluno') {
        const data =
          request.method === 'POST'
            ? validate(alunoCreate, request.body)
            : validate(alunoUpdate, request.body);
        if (data.aluno_id)
          await this.http.exists(
            'alunos',
            data.aluno_id,
            request.headers.authorization!,
          );
      }
      if (resource === 'alocacao_professor') {
        const data =
          request.method === 'POST'
            ? validate(professorCreate, request.body)
            : validate(professorUpdate, request.body);
        if (data.professor_id)
          await this.http.exists(
            'professores',
            data.professor_id,
            request.headers.authorization!,
          );
      }
    }
    return this.where(resource, user);
  }
  async scope(user: Principal) {
    if (user.role === 'SUPER_ADMIN') return { contexts: [], aluno_ids: [] };
    const where =
      user.role === 'ALUNO'
        ? { aluno_id: user.sub }
        : {
            disciplina: {
              alocacao_professor: { some: { professor_id: user.sub } },
            },
          };
    const contexts = await databaseOperation(() =>
      this.prisma.client.alocacao_aluno.findMany({
        where,
        distinct: ['turma_id', 'disciplina_id'],
        select: { turma_id: true, disciplina_id: true },
        take: 10001,
      }),
    );
    const studentWhere =
      user.role === 'ALUNO'
        ? { aluno_id: user.sub }
        : {
            turma: {
              alocacao_aluno: {
                some: {
                  disciplina: {
                    alocacao_professor: { some: { professor_id: user.sub } },
                  },
                },
              },
            },
          };
    const rows = await databaseOperation(() =>
      this.prisma.client.alocacao_aluno.findMany({
        where: studentWhere,
        distinct: ['aluno_id'],
        select: { aluno_id: true },
        take: 10001,
      }),
    );
    if (contexts.length > 10000 || rows.length > 10000)
      throw new ServiceUnavailableException(
        'Escopo academico excede o limite.',
      );
    return {
      contexts: contexts.map((row) => ({
        turma_id: row.turma_id,
        disciplina_id: row.disciplina_id,
      })),
      aluno_ids: rows.map((row) => row.aluno_id),
    };
  }
  async context(user: Principal, input: unknown) {
    const data = validate(contextSchema, input);
    return databaseOperation(async () => {
      const db = this.prisma.client;
      const turma = await db.turma.findUnique({
        where: { id: data.turma_id },
        select: { id: true },
      });
      const disciplina = await db.disciplina.findUnique({
        where: { id: data.disciplina_id },
        select: { id: true },
      });
      if (!turma || !disciplina)
        throw new NotFoundException('Referencia nao encontrada.');
      if (
        user.role === 'PROFESSOR' &&
        data.professor_id &&
        data.professor_id !== user.sub
      )
        throw new ForbiddenException();
      if (user.role === 'ALUNO' && data.aluno_id && data.aluno_id !== user.sub)
        throw new ForbiddenException();
      const professor =
        user.role === 'PROFESSOR' ? user.sub : data.professor_id;
      if (professor) {
        const assignment = await db.alocacao_professor.findFirst({
          where: { professor_id: professor, disciplina_id: data.disciplina_id },
          select: { id: true },
        });
        if (!assignment)
          throw new ForbiddenException('Vinculo academico ausente.');
      }
      const aluno = user.role === 'ALUNO' ? user.sub : data.aluno_id;
      const allocation = await db.alocacao_aluno.findFirst({
        where: {
          turma_id: data.turma_id,
          disciplina_id: data.disciplina_id,
          ...(aluno ? { aluno_id: aluno } : {}),
        },
        select: { id: true },
      });
      if (!allocation)
        throw new ForbiddenException('Vinculo academico ausente.');
      return { allowed: true as const };
    });
  }
}
