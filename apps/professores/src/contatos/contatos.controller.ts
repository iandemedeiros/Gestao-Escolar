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
import { ContatosService } from './contatos.service.js';
@Controller('contatos')
@UseGuards(AccessGuard)
export class ContatosController {
  constructor(private readonly service: ContatosService) {}
  @Get() list(@Query() query: unknown) {
    return this.service.list(query);
  }
  @Get(':id') findById(@Param('id') id: string) {
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
