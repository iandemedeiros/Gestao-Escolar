import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MensagensService } from './mensagens.service.js';
import { MensagensRepository } from './mensagens.repository.js';
import { select, updateSchema } from './dto.js';
import {
  createPrismaMock,
  knownError,
} from '../../test/support/crud-fixtures.js';
const id = '123e4567-e89b-42d3-a456-426614174000';
const sample = {
  remetenteId: '123e4567-e89b-42d3-a456-426614174010',
  destinatarioId: '123e4567-e89b-42d3-a456-426614174011',
  tipoId: '123e4567-e89b-42d3-a456-426614174012',
  conteudo: 'Mensagem ficticia',
};
const patch = { conteudo: 'Novo conteudo ficticio' };
const expected = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  remetenteId: '123e4567-e89b-42d3-a456-426614174010',
  destinatarioId: '123e4567-e89b-42d3-a456-426614174011',
  tipoId: '123e4567-e89b-42d3-a456-426614174012',
  dataEnvio: '2026-10-01T12:00:00.000Z',
};
describe('comunicacao/mensagens with simulated Prisma', () => {
  let service: MensagensService;
  let prisma: ReturnType<typeof createPrismaMock>;
  beforeEach(async () => {
    prisma = createPrismaMock();
    const module = await Test.createTestingModule({
      providers: [
        MensagensService,
        MensagensRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(MensagensService);
  });
  it('paginates with explicit selection and deterministic ordering', async () => {
    expect(await service.list({ page: '2', limit: '5' })).toEqual({
      data: [expected],
      page: 2,
      limit: 5,
      total: 1,
    });
    expect(prisma.client.mensagem.findMany).toHaveBeenCalledWith({
      select,
      skip: 5,
      take: 5,
      orderBy: { id: 'asc' },
    });
  });
  it('uses bounded default pagination and accepts maximum limit', async () => {
    expect(await service.list({})).toMatchObject({ page: 1, limit: 20 });
    await service.list({ limit: '100' });
    expect(prisma.client.mensagem.findMany).toHaveBeenLastCalledWith(
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
    expect(prisma.client.mensagem.findUnique).toHaveBeenCalledWith({
      where: { id: id },
      select,
    });
    expect(Object.keys(select).sort()).toEqual([
      'dataEnvio',
      'destinatarioId',
      'id',
      'remetenteId',
      'tipoId',
    ]);
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
      expect(prisma.client.mensagem.findUnique).not.toHaveBeenCalled();
      expect(prisma.client.$transaction).not.toHaveBeenCalled();
      expect(prisma.client.mensagem.delete).not.toHaveBeenCalled();
    },
  );
  it('returns 404 for a missing record', async () => {
    prisma.client.mensagem.findUnique.mockResolvedValue(null);
    await expect(service.findById(id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('creates using server-owned fields and explicit response', async () => {
    expect(await service.create(sample)).toEqual(expected);
    const args = prisma.client.mensagem.create.mock.calls[0][0];
    expect(args.select).toEqual(select);
    expect(args.data.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(args.data.dataEnvio).toBeInstanceOf(Date);
    expect(args.data.dataEnvio.getMilliseconds()).toBe(0);
    expect(prisma.client.tipomensagem.findUnique).toHaveBeenCalledWith({
      where: { id: sample.tipoId },
      select: { id: true },
    });
  });
  it('updates only allowed fields', async () => {
    expect(await service.update(id, patch)).toEqual(expected);
    expect(prisma.client.mensagem.update).toHaveBeenCalledWith({
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
    expect(prisma.client.mensagem.create).not.toHaveBeenCalled();
  });
  it.each([
    { key: 'remetenteId', value: 'invalid' },
    { key: 'destinatarioId', value: 'invalid' },
    { key: 'tipoId', value: 'invalid' },
    { key: 'conteudo', value: {} },
  ])('validates $key before database access', async ({ key, value }) => {
    await expect(
      service.create({ ...sample, [key]: value }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
  });
  it('returns 404 if update target does not exist', async () => {
    prisma.client.mensagem.findUnique.mockResolvedValue(null);
    await expect(service.update(id, patch)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.client.mensagem.update).not.toHaveBeenCalled();
  });
  it('deletes only the selected record and returns no data', async () => {
    expect(await service.delete(id)).toBeUndefined();
    expect(prisma.client.mensagem.delete).toHaveBeenCalledWith({
      where: { id: id },
      select: { id: true },
    });
  });
  it('returns 404 for a missing delete target', async () => {
    prisma.client.mensagem.delete.mockRejectedValue(knownError('P2025'));
    await expect(service.delete(id)).rejects.toBeInstanceOf(NotFoundException);
  });
  it.each([
    ['P2002', ConflictException],
    ['P2003', ConflictException],
    ['P2000', BadRequestException],
    ['P2028', ServiceUnavailableException],
  ] as const)('sanitizes Prisma error %s', async (code, errorClass) => {
    prisma.client.mensagem.create.mockRejectedValue(knownError(code));
    await expect(service.create(sample)).rejects.toBeInstanceOf(errorClass);
  });
  it('sanitizes unexpected driver errors', async () => {
    prisma.client.mensagem.findUnique.mockRejectedValue(
      new Error('private data'),
    );
    await expect(service.findById(id)).rejects.toThrow(
      'Operacao temporariamente indisponivel.',
    );
  });
  it('checks missing local tipoId before writes', async () => {
    prisma.client.tipomensagem.findUnique.mockResolvedValue(null);
    await expect(service.create(sample)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.client.mensagem.create).not.toHaveBeenCalled();
    await expect(
      service.update(id, { tipoId: sample.tipoId }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.client.mensagem.update).not.toHaveBeenCalled();
  });
});
