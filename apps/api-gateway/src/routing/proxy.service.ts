import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request } from 'express';
const routes: Record<string, { env: string; port: number; target?: string }> = {
  alunos: { env: 'ALUNOS_SERVICE_URL', port: 3001 },
  professores: { env: 'PROFESSORES_SERVICE_URL', port: 3002 },
  'contatos-professores': {
    env: 'PROFESSORES_SERVICE_URL',
    port: 3002,
    target: 'contatos',
  },
  'disponibilidades-professores': {
    env: 'PROFESSORES_SERVICE_URL',
    port: 3002,
    target: 'disponibilidades',
  },
  turmas: { env: 'TURMAS_DISCIPLINAS_SERVICE_URL', port: 3003 },
  disciplinas: { env: 'TURMAS_DISCIPLINAS_SERVICE_URL', port: 3003 },
  'alocacoes-alunos': { env: 'TURMAS_DISCIPLINAS_SERVICE_URL', port: 3003 },
  'alocacoes-professores': {
    env: 'TURMAS_DISCIPLINAS_SERVICE_URL',
    port: 3003,
  },
  avaliacoes: { env: 'AVALIACOES_NOTAS_SERVICE_URL', port: 3004 },
  notas: { env: 'AVALIACOES_NOTAS_SERVICE_URL', port: 3004 },
  mensagens: { env: 'COMUNICACAO_SERVICE_URL', port: 3005 },
  'tipos-mensagem': { env: 'COMUNICACAO_SERVICE_URL', port: 3005 },
};
export const routedPaths = Object.keys(routes).flatMap((path) => [
  path,
  path + '/*tail',
]);
function privateFields(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(privateFields);
  if (value && typeof value === 'object')
    return Object.entries(value).some(
      ([key, item]) =>
        /^(senha|senha_hash|password|cpf|email|endereco.*|telefone|celular|access_token|internal_auth_token)$/i.test(
          key,
        ) || privateFields(item),
    );
  return false;
}
@Injectable()
export class ProxyService {
  async forward(request: Request) {
    const index = request.originalUrl.indexOf('?'),
      path =
        index < 0 ? request.originalUrl : request.originalUrl.slice(0, index),
      query = index < 0 ? '' : request.originalUrl.slice(index);
    if (
      !/^\/[a-z0-9_/-]+$/i.test(path) ||
      path.includes('//') ||
      request.originalUrl.length > 8192
    )
      throw new BadRequestException('Caminho invalido.');
    const [first, ...tail] = path.slice(1).split('/');
    const route = routes[first];
    if (!route) throw new BadRequestException('Caminho invalido.');
    if (
      !['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'].includes(
        request.method,
      )
    )
      throw new HttpException('Metodo nao permitido.', 405);
    try {
      const base = new URL(
        process.env[route.env] ?? 'http://127.0.0.1:' + route.port,
      );
      if (
        !['http:', 'https:'].includes(base.protocol) ||
        base.username ||
        base.password
      )
        throw new Error();
      const target = new URL(
        '/' +
          (route.target ?? first) +
          (tail.length ? '/' + tail.join('/') : '') +
          query,
        base,
      );
      const response = await fetch(target, {
        method: request.method,
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
        headers: {
          authorization: request.headers.authorization!,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        ...(!['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
        request.body !== undefined
          ? { body: JSON.stringify(request.body) }
          : {}),
      });
      if (response.status >= 400) {
        const status = response.status;
        const message =
          (
            {
              400: 'Entrada invalida.',
              401: 'Nao autenticado.',
              403: 'Acesso negado.',
              404: 'Registro nao encontrado.',
              409: 'Conflito nos dados.',
              429: 'Tente novamente mais tarde.',
            } as Record<number, string>
          )[status] ?? 'Servico indisponivel.';
        return {
          status,
          body: { statusCode: status, message },
          contentType: 'application/json',
        };
      }
      if (
        response.status === 204 ||
        response.status === 304 ||
        request.method === 'HEAD'
      )
        return {
          status: response.status,
          body: undefined,
          contentType: undefined,
        };
      const body: unknown = await response.json();
      if (privateFields(body)) throw new Error();
      return { status: response.status, body, contentType: 'application/json' };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Servico indisponivel.');
    }
  }
}
