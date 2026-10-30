import { ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard, JwtTokens, type AuthRequest } from '../auth/security.js';
import { AcademicPolicy, type Resource } from './academic.policy.js';
export const AcademicResource = (resource: Resource) =>
  SetMetadata('school:resource', resource);
export type AcademicRequest = AuthRequest & { academicWhere?: unknown };
export function academicScope<T>(request: AcademicRequest): T | undefined {
  return request.academicWhere as T | undefined;
}
@Injectable()
export class AcademicGuard extends JwtAuthGuard {
  constructor(
    tokens: JwtTokens,
    private readonly policies: Reflector,
    private readonly academic: AcademicPolicy,
  ) {
    super(tokens, policies);
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await super.canActivate(context))) return false;
    const resource = this.policies.getAllAndOverride<Resource>(
      'school:resource',
      [context.getHandler(), context.getClass()],
    );
    if (resource) {
      const request = context.switchToHttp().getRequest<AcademicRequest>();
      request.academicWhere = await this.academic.authorize(resource, request);
    }
    return true;
  }
}
