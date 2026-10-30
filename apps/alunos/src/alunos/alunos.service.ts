import {
  Injectable,
  NotFoundException,
  ParseUUIDPipe,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AlunosRepository } from './alunos.repository.js';
import { AlunoResponseDto } from './dto/aluno-response.dto.js';

@Injectable()
export class AlunosService {
  constructor(private readonly repository: AlunosRepository) {}

  async findById(id: string): Promise<AlunoResponseDto> {
    await new ParseUUIDPipe().transform(id, { type: 'param', data: 'id' });
    let aluno;
    try {
      aluno = await this.repository.findById(id);
    } catch {
      // Do not propagate database errors or personal information to logs/responses.
      throw new ServiceUnavailableException('Consulta de aluno indisponivel.');
    }
    if (!aluno) {
      throw new NotFoundException('Aluno nao encontrado.');
    }
    return {
      id: aluno.id,
      nome: aluno.nome,
      data_nascimento: aluno.data_nascimento.toISOString().slice(0, 10),
    };
  }
}
