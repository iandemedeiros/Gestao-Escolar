import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlunosService } from './alunos.service.js';
import { AlunosRepository } from './alunos.repository.js';
import { PasswordHasher } from './password-hasher.service.js';
import { ContatosService } from '../contatos/contatos.service.js';
import { ContatosRepository } from '../contatos/contatos.repository.js';
import {
  alunoId,
  otherAlunoId,
  contatoId,
  alunoInput,
  alunoResponse,
  contatoResponse,
  knownError,
  createPrismaMock,
} from '../../test/support/crud-fixtures.js';

describe('Alunos and Contatos business rules with simulated Prisma', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let alunos: AlunosService;
  let contatos: ContatosService;
  const hash = vi.fn();

  beforeEach(async () => {
    prisma = createPrismaMock();
    hash.mockReset().mockResolvedValue('$argon2id$test-placeholder');
    const module = await Test.createTestingModule({
      providers: [
        AlunosService,
        AlunosRepository,
        ContatosService,
        ContatosRepository,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordHasher, useValue: { hash } },
      ],
    }).compile();
    alunos = module.get(AlunosService);
    contatos = module.get(ContatosService);
  });

  it('paginates alunos deterministically with explicit selection', async () => {
    expect(await alunos.list({ page: '2', limit: '10' })).toEqual({
      data: [alunoResponse],
      page: 2,
      limit: 10,
      total: 1,
    });
    expect(prisma.client.aluno.findMany).toHaveBeenCalledWith({
      select: { id: true, nome: true, data_nascimento: true },
      skip: 10,
      take: 10,
      orderBy: { id: 'asc' },
    });
    expect(prisma.client.aluno.count).toHaveBeenCalledOnce();
  });
  it('defaults pagination and supports the maximum limit', async () => {
    expect(await alunos.list({})).toMatchObject({ page: 1, limit: 20 });
    await alunos.list({ limit: '100' });
    expect(prisma.client.aluno.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
  it.each([
    { limit: 101 },
    { limit: 0 },
    { limit: -1 },
    { page: 0 },
    { page: 10001 },
    { page: '1.5' },
    { limit: ['1'] },
    { limit: true },
    { search: 'private' },
  ])('rejects invalid pagination %j', async (query) => {
    await expect(alunos.list(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
  });
  it('generates server ID, hashes password and never returns private fields', async () => {
    expect(await alunos.create(alunoInput)).toEqual(alunoResponse);
    expect(hash).toHaveBeenCalledExactlyOnceWith(alunoInput.senha);
    const args = prisma.client.aluno.create.mock.calls[0][0];
    expect(args.data.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(args.data.senha_hash).toBe('$argon2id$test-placeholder');
    expect(args.data).not.toHaveProperty('senha');
    expect(args.select).toEqual({
      id: true,
      nome: true,
      data_nascimento: true,
    });
  });
  it('updates a password only through hashing', async () => {
    expect(await alunos.update(alunoId, { senha: alunoInput.senha })).toEqual(
      alunoResponse,
    );
    expect(prisma.client.aluno.update).toHaveBeenCalledWith({
      where: { id: alunoId },
      data: { senha_hash: '$argon2id$test-placeholder' },
      select: { id: true, nome: true, data_nascimento: true },
    });
  });
  it('updates optional nullable addresses without touching the password', async () => {
    await alunos.update(alunoId, { endereco_rua: null, endereco_estado: 'sp' });
    expect(hash).not.toHaveBeenCalled();
    expect(prisma.client.aluno.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { endereco_rua: null, endereco_estado: 'SP' },
      }),
    );
  });
  it.each([
    { ...alunoInput, senha_hash: 'injected' },
    { ...alunoInput, id: alunoId },
    { ...alunoInput, contato: [] },
    { ...alunoInput, cpf: '1234567890' },
    { ...alunoInput, email: 'invalid' },
    { ...alunoInput, senha: 'short' },
    { ...alunoInput, nome: '' },
    { ...alunoInput, nome: 'x'.repeat(151) },
    { ...alunoInput, data_nascimento: '2000-02-30' },
    { ...alunoInput, data_nascimento: '2999-01-01' },
    { ...alunoInput, endereco_estado: 'XYZ' },
    { ...alunoInput, endereco_cep: 'invalid' },
    { ...alunoInput, cpf: null },
    null,
    [],
  ])(
    'rejects invalid aluno bodies without database/hash access',
    async (body) => {
      await expect(alunos.create(body)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(hash).not.toHaveBeenCalled();
      expect(prisma.client.aluno.create).not.toHaveBeenCalled();
    },
  );
  it.each([
    {},
    { senha_hash: 'injected' },
    { nome: null },
    { aluno_id: otherAlunoId },
  ])('rejects empty/unsafe patches', async (body) => {
    await expect(alunos.update(alunoId, body)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.client.aluno.update).not.toHaveBeenCalled();
  });
  it('deletes only the requested aluno and returns no data', async () => {
    expect(await alunos.delete(alunoId)).toBeUndefined();
    expect(prisma.client.aluno.delete).toHaveBeenCalledWith({
      where: { id: alunoId },
      select: { id: true },
    });
  });
  it.each(['update', 'delete'] as const)(
    'maps missing aluno during %s to 404',
    async (operation) => {
      prisma.client.aluno[operation].mockRejectedValue(knownError('P2025'));
      await expect(
        operation === 'update'
          ? alunos.update(alunoId, { nome: 'Novo' })
          : alunos.delete(alunoId),
      ).rejects.toBeInstanceOf(NotFoundException);
    },
  );
  it.each(['create', 'update'] as const)(
    'maps unique %s conflicts to 409 without details',
    async (operation) => {
      prisma.client.aluno[operation].mockRejectedValue(knownError('P2002'));
      await expect(
        operation === 'create'
          ? alunos.create(alunoInput)
          : alunos.update(alunoId, { email: alunoInput.email }),
      ).rejects.toBeInstanceOf(ConflictException);
    },
  );
  it('does not query or write if hashing fails', async () => {
    hash.mockRejectedValue(new ServiceUnavailableException('Unavailable'));
    await expect(alunos.create(alunoInput)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.client.aluno.create).not.toHaveBeenCalled();
  });
  it('lists only contacts belonging to the route aluno', async () => {
    expect(await contatos.list(alunoId, { page: '2', limit: '5' })).toEqual({
      data: [contatoResponse],
      total: 1,
      page: 2,
      limit: 5,
    });
    expect(prisma.client.contato.findMany).toHaveBeenCalledWith({
      where: { aluno_id: alunoId },
      select: { id: true, aluno_id: true },
      skip: 5,
      take: 5,
      orderBy: { id: 'asc' },
    });
    expect(prisma.client.contato.count).toHaveBeenCalledWith({
      where: { aluno_id: alunoId },
    });
  });
  it('creates a contact under a checked parent with server-owned IDs', async () => {
    expect(await contatos.create(alunoId, { telefone: '12345678' })).toEqual(
      contatoResponse,
    );
    expect(prisma.client.aluno.findUnique).toHaveBeenCalledWith({
      where: { id: alunoId },
      select: { id: true },
    });
    expect(prisma.client.contato.create).toHaveBeenCalledWith({
      data: { telefone: '12345678', aluno_id: alunoId, id: expect.any(String) },
      select: { id: true, aluno_id: true },
    });
  });
  it.each(['list', 'create'] as const)(
    'returns 404 on missing parent during contact %s',
    async (operation) => {
      prisma.client.aluno.findUnique.mockResolvedValue(null);
      await expect(
        operation === 'list'
          ? contatos.list(alunoId, {})
          : contatos.create(alunoId, { telefone: '123' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.client.contato.create).not.toHaveBeenCalled();
      expect(prisma.client.contato.findMany).not.toHaveBeenCalled();
    },
  );
  it('scopes contact update atomically and returns minimal fields', async () => {
    expect(
      await contatos.update(alunoId, contatoId, { celular: null }),
    ).toEqual(contatoResponse);
    expect(prisma.client.contato.update).toHaveBeenCalledWith({
      where: { id: contatoId, aluno_id: alunoId },
      data: { celular: null },
      select: { id: true, aluno_id: true },
    });
  });
  it('scopes contact delete atomically and returns no data', async () => {
    expect(await contatos.delete(alunoId, contatoId)).toBeUndefined();
    expect(prisma.client.contato.delete).toHaveBeenCalledWith({
      where: { id: contatoId, aluno_id: alunoId },
      select: { id: true },
    });
  });
  it.each(['update', 'delete'] as const)(
    'does not mutate another aluno contact during %s',
    async (operation) => {
      prisma.client.contato[operation].mockImplementation(async ({ where }) => {
        if (where.aluno_id !== alunoId) throw knownError('P2025');
        return contatoResponse;
      });
      await expect(
        operation === 'update'
          ? contatos.update(otherAlunoId, contatoId, { telefone: '123' })
          : contatos.delete(otherAlunoId, contatoId),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.client.contato[operation]).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: contatoId, aluno_id: otherAlunoId },
        }),
      );
    },
  );
  it.each([
    {},
    { aluno_id: otherAlunoId, telefone: '123' },
    { id: contatoId, telefone: '123' },
    { email: 'invalid' },
    { telefone: 'x'.repeat(16) },
    { telefone: null, celular: null, email: null },
    { senha_hash: 'private' },
  ])('rejects invalid contact creation', async (body) => {
    await expect(contatos.create(alunoId, body)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
  });
  it('rejects bad UUIDs in every mutation before database access', async () => {
    for (const operation of [
      () => alunos.update('bad', { nome: 'Novo' }),
      () => alunos.delete('bad'),
      () => contatos.list('bad', {}),
      () => contatos.create('bad', { telefone: '123' }),
      () => contatos.update(alunoId, 'bad', { telefone: '123' }),
      () => contatos.delete('bad', contatoId),
    ])
      await expect(operation()).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
    expect(prisma.client.contato.update).not.toHaveBeenCalled();
    expect(prisma.client.contato.delete).not.toHaveBeenCalled();
  });
});
