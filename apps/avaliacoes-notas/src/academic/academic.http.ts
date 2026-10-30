import {
  Injectable,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
const scopeSchema = z.strictObject({
  contexts: z
    .array(
      z.strictObject({
        turma_id: z.number().int().positive(),
        disciplina_id: z.uuid(),
      }),
    )
    .max(10000),
  aluno_ids: z.array(z.uuid()).max(10000),
});
@Injectable()
export class AcademicHttp {
  private async post<T>(
    domain: 'alunos' | 'professores' | 'turmas',
    path: string,
    body: unknown,
    bearer: string,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const secret = process.env.INTERNAL_AUTH_TOKEN;
    if (!secret || Buffer.byteLength(secret) < 32)
      throw new ServiceUnavailableException('Integracao indisponivel.');
    try {
      const base =
        domain === 'alunos'
          ? (process.env.ALUNOS_SERVICE_URL ?? 'http://127.0.0.1:3001')
          : domain === 'professores'
            ? (process.env.PROFESSORES_SERVICE_URL ?? 'http://127.0.0.1:3002')
            : (process.env.TURMAS_DISCIPLINAS_SERVICE_URL ??
              'http://127.0.0.1:3003');
      const url = new URL(base);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error();
      const response = await fetch(new URL(path, url), {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(3000),
        headers: {
          authorization: bearer,
          'x-internal-auth-token': secret,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if ([400, 401, 403, 404, 409, 429].includes(response.status))
        throw new HttpException(
          response.status === 404
            ? 'Referencia nao encontrada.'
            : 'Acesso academico negado.',
          response.status,
        );
      if (!response.ok) throw new Error();
      return schema.parse(await response.json());
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Integracao indisponivel.');
    }
  }
  scope(bearer: string) {
    return this.post(
      'turmas',
      '/internal/academic/scope',
      {},
      bearer,
      scopeSchema,
    );
  }
  context(
    body: {
      turma_id: number;
      disciplina_id: string;
      professor_id?: string;
      aluno_id?: string;
    },
    bearer: string,
  ) {
    const { turma_id, disciplina_id, professor_id, aluno_id } = body;
    return this.post(
      'turmas',
      '/internal/academic/context',
      {
        turma_id,
        disciplina_id,
        ...(professor_id ? { professor_id } : {}),
        ...(aluno_id ? { aluno_id } : {}),
      },
      bearer,
      z.strictObject({ allowed: z.literal(true) }),
    );
  }
  exists(domain: 'alunos' | 'professores', id: string, bearer: string) {
    return this.post(
      domain,
      '/internal/academic/exists',
      { id },
      bearer,
      z.strictObject({ exists: z.literal(true) }),
    );
  }
}
