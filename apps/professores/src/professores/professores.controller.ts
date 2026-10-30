import { Roles, Self } from '../auth/security.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccessGuard } from '../common/access.guard.js';
import { ProfessoresService } from './professores.service.js';
@Roles('SUPER_ADMIN')
@Controller('professores')
@UseGuards(AccessGuard)
export class ProfessoresController {
  constructor(private readonly service: ProfessoresService) {}
  @Get() list(@Query() query: unknown) {
    return this.service.list(query);
  }
  @Roles('SUPER_ADMIN', 'PROFESSOR')
  @Self('id', 'PROFESSOR')
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }
  @Post() create(@Body() body: unknown) {
    return this.service.create(body);
  }
  @Patch(':id') update(@Param('id') id: string, @Body() body: unknown) {
    return this.service.update(id, body);
  }
  @Delete(':id') @HttpCode(204) delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
