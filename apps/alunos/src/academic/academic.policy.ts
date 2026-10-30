import { ForbiddenException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { validate } from '../common/validation.js';
import { paginationSchema } from '../common/pagination.dto.js';
import type { AuthRequest } from '../auth/security.js';
import { AcademicHttp } from './academic.http.js';
export type Resource = 'aluno';
@Injectable()
export class AcademicPolicy {
  constructor(private readonly http: AcademicHttp) {}
  async authorize(_resource: Resource, request: AuthRequest): Promise<unknown> {
    const user = request.user,
      id = request.params.id
        ? validate(z.uuid(), request.params.id)
        : undefined;
    if (user.role === 'SUPER_ADMIN') return {};
    if (!['GET', 'HEAD'].includes(request.method))
      throw new ForbiddenException();
    validate(paginationSchema, id ? {} : request.query);
    if (user.role === 'ALUNO') {
      if (!id || id.toLowerCase() !== user.sub.toLowerCase())
        throw new ForbiddenException();
      return { id: user.sub };
    }
    const scope = await this.http.scope(request.headers.authorization!);
    if (
      id &&
      !scope.aluno_ids.some((value) => value.toLowerCase() === id.toLowerCase())
    )
      throw new ForbiddenException();
    return { id: { in: scope.aluno_ids } };
  }
}
