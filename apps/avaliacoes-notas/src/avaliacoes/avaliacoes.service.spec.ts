import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AvaliacoesService } from './avaliacoes.service.js';
import { AvaliacoesRepository } from './avaliacoes.repository.js';
import { select, updateSchema } from './dto.js';
import {
  createPrismaMock,
  knownError,
  avaliacaoRow,
} from '../../test/support/crud-fixtures.js';
const id = '123e4567-e89b-42d3-a456-426614174000';
const sample = {
  turma_id: 1,
  disciplina_id: '123e4567-e89b-42d3-a456-426614174010',
  professor_id: '123e4567-e89b-42d3-a456-426614174011',
  titulo: 'Avaliacao ficticia',
  tipo: 'prova',
  peso: '1.25',
  data_realizacao: '2026-10-01',
  data_entrega_final: '2026-10-02T12:00:00Z',
};
const patch = { peso: '2.50' };
const expected = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  turma_id: 1,
  disciplina_id: '123e4567-e89b-42d3-a456-426614174010',
  professor_id: '123e4567-e89b-42d3-a456-426614174011',
  titulo: 'Avaliacao ficticia',
  tipo: 'prova',
  peso: '1.25',
  data_realizacao: '2026-10-01',
  data_entrega_final: '2026-10-02T12:00:00.000Z',
  entrega_do_aluno: null,
};
describe('avaliacoes-notas/avaliacoes with simulated Prisma', () => {
  let service: AvaliacoesService;
  let prisma: ReturnType<typeof createPrismaMock>;
  beforeEach(async () => {
    prisma = createPrismaMock();
    const module = await Test.createTestingModule({
      providers: [
        AvaliacoesService,
        AvaliacoesRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(AvaliacoesService);
  });
  it('paginates with explicit selection and deterministic ordering', async () => {
    expect(await service.list({ page: '2', limit: '5' })).toEqual({
      data: [expected],
      page: 2,
      limit: 5,
      total: 1,
    });
    expect(prisma.client.avaliacao.findMany).toHaveBeenCalledWith({
      select,
      skip: 5,
      take: 5,
      orderBy: { id: 'asc' },
    });
  });
  it('uses bounded default pagination and accepts maximum limit', async () => {
    expect(await service.list({})).toMatchObject({ page: 1, limit: 20 });
    await service.list({ limit: '100' });
    expect(prisma.client.avaliacao.findMany).toHaveBeenLastCalledWith(
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
    expect(prisma.client.avaliacao.findUnique).toHaveBeenCalledWith({
      where: { id: id },
      select,
    });
    expect(Object.keys(select).sort()).toEqual([
      'data_entrega_final',
      'data_realizacao',
      'disciplina_id',
      'entrega_do_aluno',
      'id',
      'peso',
      'professor_id',
      'tipo',
      'titulo',
      'turma_id',
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
      expect(prisma.client.avaliacao.findUnique).not.toHaveBeenCalled();
      expect(prisma.client.$transaction).not.toHaveBeenCalled();
      expect(prisma.client.avaliacao.delete).not.toHaveBeenCalled();
    },
  );
  it('returns 404 for a missing record', async () => {
    prisma.client.avaliacao.findUnique.mockResolvedValue(null);
    await expect(service.findById(id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('creates using server-owned fields and explicit response', async () => {
    expect(await service.create(sample)).toEqual(expected);
    const args = prisma.client.avaliacao.create.mock.calls[0][0];
    expect(args.select).toEqual(select);
    expect(args.data.id).toMatch(/^[a-f0-9-]{36}$/);
  });
  it('updates only allowed fields', async () => {
    expect(await service.update(id, patch)).toEqual(expected);
    expect(prisma.client.avaliacao.update).toHaveBeenCalledWith({
      where: {
        id: id,
        data_realizacao: avaliacaoRow.data_realizacao,
        data_entrega_final: avaliacaoRow.data_entrega_final,
      },
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
    expect(prisma.client.avaliacao.create).not.toHaveBeenCalled();
  });
  it.each([
    { key: 'turma_id', value: 0 },
    { key: 'disciplina_id', value: 'invalid' },
    { key: 'professor_id', value: 'invalid' },
    { key: 'titulo', value: {} },
    { key: 'tipo', value: {} },
    { key: 'peso', value: '1000.00' },
    { key: 'data_realizacao', value: '2026-02-30' },
    { key: 'data_entrega_final', value: 'bad-date' },
    { key: 'entrega_do_aluno', value: 'bad-date' },
  ])('validates $key before database access', async ({ key, value }) => {
    await expect(
      service.create({ ...sample, [key]: value }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
  });
  it('returns 404 if update target does not exist', async () => {
    prisma.client.avaliacao.findUnique.mockResolvedValue(null);
    await expect(service.update(id, patch)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.client.avaliacao.update).not.toHaveBeenCalled();
  });
  it('deletes only the selected record and returns no data', async () => {
    expect(await service.delete(id)).toBeUndefined();
    expect(prisma.client.avaliacao.delete).toHaveBeenCalledWith({
      where: { id: id },
      select: { id: true },
    });
  });
  it('returns 404 for a missing delete target', async () => {
    prisma.client.avaliacao.delete.mockRejectedValue(knownError('P2025'));
    await expect(service.delete(id)).rejects.toBeInstanceOf(NotFoundException);
  });
  it.each([
    ['P2002', ConflictException],
    ['P2003', ConflictException],
    ['P2000', BadRequestException],
    ['P2028', ServiceUnavailableException],
  ] as const)('sanitizes Prisma error %s', async (code, errorClass) => {
    prisma.client.avaliacao.create.mockRejectedValue(knownError(code));
    await expect(service.create(sample)).rejects.toBeInstanceOf(errorClass);
  });
  it('sanitizes unexpected driver errors', async () => {
    prisma.client.avaliacao.findUnique.mockRejectedValue(
      new Error('private data'),
    );
    await expect(service.findById(id)).rejects.toThrow(
      'Operacao temporariamente indisponivel.',
    );
  });
  it('checks complete state on create and partial update', async () => {
    await expect(
      service.create({
        ...sample,
        data_realizacao: '2026-10-03',
        data_entrega_final: '2026-10-02T12:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update(id, { data_entrega_final: '2026-09-01T12:00:00Z' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.client.avaliacao.update).not.toHaveBeenCalled();
  });
  it('detects optimistic concurrency conflicts', async () => {
    prisma.client.avaliacao.update.mockRejectedValue(knownError('P2025'));
    await expect(service.update(id, patch)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
