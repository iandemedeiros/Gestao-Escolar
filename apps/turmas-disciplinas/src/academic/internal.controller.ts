import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { validate } from '../common/validation.js';
import {
  InternalAuthGuard,
  JwtAuthGuard,
  Roles,
  type AuthRequest,
} from '../auth/security.js';
import { AcademicPolicy } from './academic.policy.js';
@Controller('internal/academic')
@UseGuards(InternalAuthGuard, JwtAuthGuard)
@Roles('SUPER_ADMIN', 'PROFESSOR', 'ALUNO')
export class InternalAcademicController {
  constructor(private readonly policy: AcademicPolicy) {}
  @Post('scope') @HttpCode(200) scope(
    @Req() request: AuthRequest,
    @Body() body: unknown,
  ) {
    validate(z.strictObject({}), body);
    return this.policy.scope(request.user);
  }
  @Post('context') @HttpCode(200) context(
    @Req() request: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.policy.context(request.user, body);
  }
}
