import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlunosService } from './alunos.service.js';
import { AlunosRepository } from './alunos.repository.js';
import { PasswordHasher } from './password-hasher.service.js';

const id = '123e4567-e89b-42d3-a456-426614174000';

describe('AlunosService with simulated Prisma', () => {
  const findUnique = vi.fn();
  let service: AlunosService;

  beforeEach(async () => {
    findUnique.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        AlunosService,
        AlunosRepository,
        { provide: PasswordHasher, useValue: { hash: vi.fn() } },
        {
          provide: PrismaService,
          useValue: { client: { aluno: { findUnique } } },
        },
      ],
    }).compile();
    service = module.get(AlunosService);
  });

  it('selects and returns only permitted fields', async () => {
    findUnique.mockResolvedValue({
      id,
      nome: 'Aluno ficticio',
      data_nascimento: new Date('2000-01-02T00:00:00Z'),
      cpf: 'private',
      email: 'private',
      senha_hash: 'private',
      endereco_rua: 'private',
      contato: ['private'],
    });
    expect(await service.findById(id)).toEqual({
      id,
      nome: 'Aluno ficticio',
      data_nascimento: '2000-01-02',
    });
    expect(findUnique).toHaveBeenCalledExactlyOnceWith({
      where: { id },
      select: { id: true, nome: true, data_nascimento: true },
    });
  });

  it('rejects an invalid UUID without accessing Prisma', async () => {
    await expect(service.findById('invalid')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing aluno', async () => {
    findUnique.mockResolvedValue(null);
    await expect(service.findById(id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sanitizes database failures', async () => {
    findUnique.mockRejectedValue(new Error('private driver details'));
    await expect(service.findById(id)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(service.findById(id)).rejects.toThrow(
      'Consulta de aluno indisponivel.',
    );
  });
});
