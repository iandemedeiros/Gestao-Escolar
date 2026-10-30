import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import type { Principal } from './security.js';
@Injectable()
export class DomainsClient {
  private async post(
    domain: 'alunos' | 'professores',
    path: string,
    body: unknown,
    bearer?: string,
  ) {
    const secret = process.env.INTERNAL_AUTH_TOKEN;
    if (!secret || Buffer.byteLength(secret) < 32)
      throw new ServiceUnavailableException('Autenticacao indisponivel.');
    try {
      const base =
        domain === 'alunos'
          ? (process.env.ALUNOS_SERVICE_URL ?? 'http://127.0.0.1:3001')
          : (process.env.PROFESSORES_SERVICE_URL ?? 'http://127.0.0.1:3002');
      const url = new URL(base);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error();
      return await fetch(new URL(path, url), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-auth-token': secret,
          ...(bearer ? { authorization: bearer } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(3000),
        redirect: 'error',
      });
    } catch {
      throw new ServiceUnavailableException('Autenticacao indisponivel.');
    }
  }
  async verify(
    domain: 'alunos' | 'professores',
    cpf: string,
    senha: string,
  ): Promise<Principal | null> {
    const response = await this.post(domain, '/internal/auth/verify', {
      cpf,
      senha,
    });
    if (response.status === 401) return null;
    if (!response.ok)
      throw new ServiceUnavailableException('Autenticacao indisponivel.');
    try {
      return z
        .strictObject({
          sub: z.uuid(),
          role: z.literal(domain === 'alunos' ? 'ALUNO' : 'PROFESSOR'),
        })
        .parse(await response.json());
    } catch {
      throw new ServiceUnavailableException('Autenticacao indisponivel.');
    }
  }
  async change(user: Principal, bearer: string, body: unknown) {
    if (user.role === 'SUPER_ADMIN')
      throw new UnauthorizedException('Nao autenticado.');
    const response = await this.post(
      user.role === 'ALUNO' ? 'alunos' : 'professores',
      '/internal/auth/change-password',
      body,
      bearer,
    );
    if (response.status === 401)
      throw new UnauthorizedException('Credenciais invalidas.');
    if (response.status === 409) {
      const { ConflictException } = await import('@nestjs/common');
      throw new ConflictException('Senha alterada concorrentemente.');
    }
    if (!response.ok)
      throw new ServiceUnavailableException('Autenticacao indisponivel.');
    return { message: 'Senha atualizada.' };
  }
}
