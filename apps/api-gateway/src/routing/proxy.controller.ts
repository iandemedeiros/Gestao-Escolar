import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard, Roles } from '../auth/security.js';
import { ProxyService, routedPaths } from './proxy.service.js';
@Controller()
@UseGuards(JwtAuthGuard)
@Roles('SUPER_ADMIN', 'PROFESSOR', 'ALUNO')
export class ProxyController {
  constructor(private readonly proxy: ProxyService) {}
  @All(routedPaths) async handle(
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const result = await this.proxy.forward(request);
    if (result.contentType) response.type(result.contentType);
    response.status(result.status);
    if (result.body === undefined) return response.end();
    return response.json(result.body);
  }
}
