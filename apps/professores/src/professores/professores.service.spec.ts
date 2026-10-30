import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordHasher } from '../common/password-hasher.service.js';
import { ProfessoresService } from './professores.service.js';
import { ProfessoresRepository } from './professores.repository.js';
import { select, updateSchema } from './dto.js';
import {
  createPrismaMock,
  knownError,
} from '../../test/support/crud-fixtures.js';
const id = '123e4567-e89b-42d3-a456-426614174000';
const sample = {
  nome: 'Professor ficticio',
  cpf: '52998224725',
  email: 'professor@example.invalid',
  senha: 'Fictional-password-123!',
};
const patch = { nome: 'Nome alterado' };
const expected = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  nome: 'Professor ficticio',
  formacao: null,
};
describe('professores/professores with simulated Prisma', () => {
  let service: ProfessoresService;
  let prisma: ReturnType<typeof createPrismaMock>;
  const passwords = { hash: vi.fn() };
  beforeEach(async () => {
    prisma = createPrismaMock();
    passwords.hash.mockReset().mockResolvedValue('$argon2id$test-placeholder');
    const module = await Test.createTestingModule({
      providers: [
        ProfessoresService,
        ProfessoresRepository,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordHasher, useValue: passwords },
      ],
    }).compile();
    service = module.get(ProfessoresService);
  });
  it('paginates with explicit selection and deterministic ordering', async () => {
    expect(await service.list({ page: '2', limit: '5' })).toEqual({
      data: [expected],
      page: 2,
      limit: 5,
      total: 1,
    });
    expect(prisma.client.professor.findMany).toHaveBeenCalledWith({
      select,
      skip: 5,
      take: 5,
      orderBy: { id: 'asc' },
    });
  });
  it('uses bounded default pagination and accepts maximum limit', async () => {
    expect(await service.list({})).toMatchObject({ page: 1, limit: 20 });
    await service.list({ limit: '100' });
    expect(prisma.client.professor.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
  it.each([
    { page: 0 },
    { limit: 101 },
    { limit: -1 },
    { page: '1.5' },
    { limit: ['1'] },
    { page: 10001 },
    { unexpected: 'private' },
  ])('rejects invalid pagination without Prisma', async (query) => {
    await expect(service.list(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
  });
  it('retrieves one record and redacts non-selected fields', async () => {
    expect(await service.findById(id)).toEqual(expected);
    expect(prisma.client.professor.findUnique).toHaveBeenCalledWith({
      where: { id: id },
      select,
    });
    expect(Object.keys(select).sort()).toEqual(['formacao', 'id', 'nome']);
  });
  it.each(['bad', '123', '1'])(
    'rejects invalid ID before Prisma',
    async (invalid) => {
      await expect(service.findById(invalid)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.update(invalid, patch)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.delete(invalid)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.client.professor.findUnique).not.toHaveBeenCalled();
      expect(prisma.client.$transaction).not.toHaveBeenCalled();
      expect(prisma.client.professor.delete).not.toHaveBeenCalled();
    },
  );
  it('returns 404 for a missing record', async () => {
    prisma.client.professor.findUnique.mockResolvedValue(null);
    await expect(service.findById(id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('creates using server-owned fields and explicit response', async () => {
    expect(await service.create(sample)).toEqual(expected);
    const args = prisma.client.professor.create.mock.calls[0][0];
    expect(args.select).toEqual(select);
    expect(args.data.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(args.data.senha_hash).toBe('$argon2id$test-placeholder');
    expect(args.data).not.toHaveProperty('senha');
    expect(args.data.admin).toBe(false);
    expect(passwords.hash).toHaveBeenCalledExactlyOnceWith(sample.senha);
  });
  it('updates only allowed fields', async () => {
    expect(await service.update(id, patch)).toEqual(expected);
    expect(prisma.client.professor.update).toHaveBeenCalledWith({
      where: { id: id },
      data: updateSchema.parse(patch),
      select,
    });
  });
  it.each([{}, null, [], { unknown: 'private' }])(
    'rejects empty or unknown patches',
    async (body) => {
      await expect(service.update(id, body)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.client.$transaction).not.toHaveBeenCalled();
    },
  );
  it.each([
    { ...sample, id: 'injected' },
    { ...sample, unknown: 'private' },
    { ...sample, senha_hash: 'injected' },
  ])('rejects mass assignment during create', async (body) => {
    await expect(service.create(body)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.client.professor.create).not.toHaveBeenCalled();
  });
  it.each([
    { key: 'nome', value: {} },
    { key: 'cpf', value: '1234567890' },
    { key: 'email', value: 'invalid' },
    { key: 'senha', value: 'short' },
    { key: 'formacao', value: {} },
  ])('validates $key before database access', async ({ key, value }) => {
    await expect(
      service.create({ ...sample, [key]: value }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
  });
  it('returns 404 if update target does not exist', async () => {
    prisma.client.professor.findUnique.mockResolvedValue(null);
    await expect(service.update(id, patch)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.client.professor.update).not.toHaveBeenCalled();
  });
  it('deletes only the selected record and returns no data', async () => {
    expect(await service.delete(id)).toBeUndefined();
    expect(prisma.client.professor.delete).toHaveBeenCalledWith({
      where: { id: id },
      select: { id: true },
    });
  });
  it('returns 404 for a missing delete target', async () => {
    prisma.client.professor.delete.mockRejectedValue(knownError('P2025'));
    await expect(service.delete(id)).rejects.toBeInstanceOf(NotFoundException);
  });
  it.each([
    ['P2002', ConflictException],
    ['P2003', ConflictException],
    ['P2000', BadRequestException],
    ['P2028', ServiceUnavailableException],
  ] as const)('sanitizes Prisma error %s', async (code, errorClass) => {
    prisma.client.professor.create.mockRejectedValue(knownError(code));
    await expect(service.create(sample)).rejects.toBeInstanceOf(errorClass);
  });
  it('sanitizes unexpected driver errors', async () => {
    prisma.client.professor.findUnique.mockRejectedValue(
      new Error('private data'),
    );
    await expect(service.findById(id)).rejects.toThrow(
      'Operacao temporariamente indisponivel.',
    );
  });
  it('hashes password changes and rejects privilege escalation', async () => {
    await service.update(id, { senha: sample.senha });
    expect(prisma.client.professor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { senha_hash: '$argon2id$test-placeholder' },
      }),
    );
    await expect(
      service.create({ ...sample, admin: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update(id, { admin: true })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each(['12345678901', '123.456.789-01', '11111111111'])(
    'normalizes CPF without checksum validation',
    async (cpf) => {
      await service.create({ ...sample, cpf });
      const digits = cpf.replace(/\D/g, '');
      const formatted =
        digits.slice(0, 3) +
        '.' +
        digits.slice(3, 6) +
        '.' +
        digits.slice(6, 9) +
        '-' +
        digits.slice(9);
      expect(prisma.client.professor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cpf: formatted }),
        }),
      );
    },
  );
  it.each([
    'Usuario@DOMINIO.COM',
    'usuario+tag@dominio.com',
    'usuario@dominio.c',
  ])(
    'accepts basic email format without external validation',
    async (email) => {
      await service.create({ ...sample, email });
      expect(prisma.client.professor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: email.toLowerCase() }),
        }),
      );
    },
  );
  it('accepts a simple password without character-class requirements', async () => {
    await service.create({ ...sample, senha: 'senhasimples' });
    expect(passwords.hash).toHaveBeenCalledWith('senhasimples');
  });
});
