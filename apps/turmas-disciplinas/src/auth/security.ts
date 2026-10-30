import {
  CanActivate,
  ExecutionContext,
  Global,
  HttpException,
  Injectable,
  Module,
  ServiceUnavailableException,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const roles = ['SUPER_ADMIN', 'PROFESSOR', 'ALUNO'] as const;
export type Role = (typeof roles)[number];
export interface Principal {
  sub: string;
  role: Role;
}
export type AuthRequest = Request & { user: Principal };
export const Roles = (...allowed: Role[]) =>
  SetMetadata('school:roles', allowed);
export const Self = (param: string, role: Role) =>
  SetMetadata('school:self', { param, role });
export const invalidLogin = () =>
  new UnauthorizedException('Credenciais invalidas.');
const issuer = 'gestao-escolar';
const audience = 'gestao-escolar-api';

@Injectable()
export class JwtTokens {
  private key() {
    const value = process.env.JWT_SECRET;
    if (!value || Buffer.byteLength(value) < 32)
      throw new ServiceUnavailableException('Autenticacao indisponivel.');
    return new TextEncoder().encode(value);
  }
  async sign(user: Principal): Promise<string> {
    return new SignJWT({ role: user.role })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.sub)
      .setIssuedAt()
      .setIssuer(issuer)
      .setAudience(audience)
      .setExpirationTime('15m')
      .sign(this.key());
  }
  async verify(authorization: unknown): Promise<Principal> {
    try {
      if (
        typeof authorization !== 'string' ||
        authorization.length > 4096 ||
        !/^Bearer [^\s]+$/.test(authorization)
      )
        throw new Error();
      const { payload, protectedHeader } = await jwtVerify(
        authorization.slice(7),
        this.key(),
        {
          algorithms: ['HS256'],
          issuer,
          audience,
          requiredClaims: ['sub', 'iat', 'exp'],
          maxTokenAge: '15m',
        },
      );
      if (protectedHeader.typ !== 'JWT') throw new Error();
      const role = z.enum(roles).parse(payload.role);
      const sub =
        role === 'SUPER_ADMIN'
          ? z.literal('super-admin').parse(payload.sub)
          : z.uuid().parse(payload.sub);
      return { sub, role };
    } catch {
      throw new UnauthorizedException('Nao autenticado.');
    }
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: JwtTokens,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    request.user = await this.tokens.verify(request.headers.authorization);
    const targets = [context.getHandler(), context.getClass()];
    const allowed =
      this.reflector.getAllAndOverride<Role[]>('school:roles', targets) ?? [];
    if (!allowed.includes(request.user.role)) return false;
    const self = this.reflector.getAllAndOverride<{
      param: string;
      role: Role;
    }>('school:self', targets);
    if (self && request.user.role !== 'SUPER_ADMIN') {
      const value = request.params[self.param];
      return (
        request.user.role === self.role &&
        typeof value === 'string' &&
        value.toLowerCase() === request.user.sub.toLowerCase()
      );
    }
    return true;
  }
}

@Injectable()
export class InternalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.INTERNAL_AUTH_TOKEN;
    const supplied = context.switchToHttp().getRequest<Request>().headers[
      'x-internal-auth-token'
    ];
    if (
      !expected ||
      Buffer.byteLength(expected) < 32 ||
      typeof supplied !== 'string' ||
      supplied.length > 512 ||
      Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    ) {
      throw new UnauthorizedException('Nao autenticado.');
    }
    return true;
  }
}

@Injectable()
export class LoginRateGuard implements CanActivate {
  private readonly windows = new Map<
    string,
    { start: number; count: number }
  >();
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    // Do not trust a frontend-supplied X-Forwarded-For; Express trust proxy stays off.
    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    for (const [ip, entry] of this.windows)
      if (now - entry.start >= 60_000) this.windows.delete(ip);
    let entry = this.windows.get(key);
    if (!entry) {
      if (this.windows.size >= 10_000)
        throw new HttpException('Tente novamente mais tarde.', 429);
      entry = { start: now, count: 0 };
      this.windows.set(key, entry);
    }
    if (++entry.count > 10)
      throw new HttpException('Tente novamente mais tarde.', 429);
    return true;
  }
}

@Global()
@Module({
  providers: [JwtTokens, JwtAuthGuard, InternalAuthGuard, LoginRateGuard],
  exports: [JwtTokens, JwtAuthGuard, InternalAuthGuard, LoginRateGuard],
})
export class SecurityModule {}
