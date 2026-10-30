import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { verify } from 'argon2';
import { DomainsClient } from './domains.client.js';
import { JwtTokens, invalidLogin, type Principal } from './security.js';
import { loginSchema, changeSchema, parse } from './auth.dto.js';
@Injectable()
export class AuthService {
  constructor(
    private readonly domains: DomainsClient,
    private readonly tokens: JwtTokens,
  ) {}
  async login(body: unknown) {
    const dto = parse(loginSchema, body);
    let user: Principal;
    if ('usuario' in dto) {
      const username = process.env.SUPER_ADMIN_USERNAME,
        encoded = process.env.SUPER_ADMIN_PASSWORD_HASH;
      if (!username || !encoded?.startsWith('$argon2id$'))
        throw new ServiceUnavailableException('Autenticacao indisponivel.');
      let valid = false;
      try {
        valid = await verify(encoded, dto.senha);
      } catch {
        throw new ServiceUnavailableException('Autenticacao indisponivel.');
      }
      if (!valid || dto.usuario !== username) throw invalidLogin();
      user = { sub: 'super-admin', role: 'SUPER_ADMIN' };
    } else {
      const results = await Promise.allSettled([
        this.domains.verify('alunos', dto.cpf, dto.senha),
        this.domains.verify('professores', dto.cpf, dto.senha),
      ]);
      if (results.some((result) => result.status === 'rejected'))
        throw new ServiceUnavailableException('Autenticacao indisponivel.');
      const users = results.flatMap((result) =>
        result.status === 'fulfilled' && result.value ? [result.value] : [],
      );
      if (users.length !== 1) throw invalidLogin();
      user = users[0];
    }
    return {
      access_token: await this.tokens.sign(user),
      token_type: 'Bearer',
      expires_in: 900,
      user: { sub: user.sub, role: user.role },
    };
  }
  change(user: Principal, bearer: string, body: unknown) {
    return this.domains.change(user, bearer, parse(changeSchema, body));
  }
}
