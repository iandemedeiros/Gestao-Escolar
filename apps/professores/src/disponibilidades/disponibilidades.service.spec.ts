import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DisponibilidadesService } from './disponibilidades.service.js';
import { DisponibilidadesRepository } from './disponibilidades.repository.js';
import { select, updateSchema } from './dto.js';
import {
  createPrismaMock,
  knownError,
  disponibilidade_horarioRow,
} from '../../test/support/crud-fixtures.js';
const id = '123e4567-e89b-42d3-a456-426614174000';
const sample = {
  professor_id: '123e4567-e89b-42d3-a456-426614174010',
  dia_semana: 'segunda',
  hora_inicio: '08:00:00',
  hora_fim: '10:00:00',
};
const patch = { hora_fim: '11:00:00' };
const expected = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  professor_id: '123e4567-e89b-42d3-a456-426614174010',
  dia_semana: 'segunda',
  hora_inicio: '08:00:00',
  hora_fim: '10:00:00',
};
describe('professores/disponibilidades with simulated Prisma', () => {
  let service: DisponibilidadesService;
  let prisma: ReturnType<typeof createPrismaMock>;
  beforeEach(async () => {
    prisma = createPrismaMock();
    const module = await Test.createTestingModule({
      providers: [
        DisponibilidadesService,
        DisponibilidadesRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(DisponibilidadesService);
  });
  it('paginates with explicit selection and deterministic ordering', async () => {
    expect(await service.list({ page: '2', limit: '5' })).toEqual({
      data: [expected],
      page: 2,
      limit: 5,
      total: 1,
    });
    expect(prisma.client.disponibilidade_horario.findMany).toHaveBeenCalledWith(
      { select, skip: 5, take: 5, orderBy: { id: 'asc' } },
    );
  });
  it('uses bounded default pagination and accepts maximum limit', async () => {
    expect(await service.list({})).toMatchObject({ page: 1, limit: 20 });
    await service.list({ limit: '100' });
    expect(
      prisma.client.disponibilidade_horario.findMany,
    ).toHaveBeenLastCalledWith(expect.objectContaining({ take: 100 }));
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
    expect(
      prisma.client.disponibilidade_horario.findUnique,
    ).toHaveBeenCalledWith({ where: { id: id }, select });
    expect(Object.keys(select).sort()).toEqual([
      'dia_semana',
      'hora_fim',
      'hora_inicio',
      'id',
      'professor_id',
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
      expect(
        prisma.client.disponibilidade_horario.findUnique,
      ).not.toHaveBeenCalled();
      expect(prisma.client.$transaction).not.toHaveBeenCalled();
      expect(
        prisma.client.disponibilidade_horario.delete,
      ).not.toHaveBeenCalled();
    },
  );
  it('returns 404 for a missing record', async () => {
    prisma.client.disponibilidade_horario.findUnique.mockResolvedValue(null);
    await expect(service.findById(id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('creates using server-owned fields and explicit response', async () => {
    expect(await service.create(sample)).toEqual(expected);
    const args = prisma.client.disponibilidade_horario.create.mock.calls[0][0];
    expect(args.select).toEqual(select);
    expect(args.data.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(prisma.client.professor.findUnique).toHaveBeenCalledWith({
      where: { id: sample.professor_id },
      select: { id: true },
    });
  });
  it('updates only allowed fields', async () => {
    expect(await service.update(id, patch)).toEqual(expected);
    expect(prisma.client.disponibilidade_horario.update).toHaveBeenCalledWith({
      where: {
        id: id,
        hora_inicio: disponibilidade_horarioRow.hora_inicio,
        hora_fim: disponibilidade_horarioRow.hora_fim,
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
    expect(prisma.client.disponibilidade_horario.create).not.toHaveBeenCalled();
  });
  it.each([
    { key: 'professor_id', value: 'invalid' },
    { key: 'dia_semana', value: {} },
    { key: 'hora_inicio', value: '24:00:00' },
    { key: 'hora_fim', value: '24:00:00' },
  ])('validates $key before database access', async ({ key, value }) => {
    await expect(
      service.create({ ...sample, [key]: value }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
  });
  it('returns 404 if update target does not exist', async () => {
    prisma.client.disponibilidade_horario.findUnique.mockResolvedValue(null);
    await expect(service.update(id, patch)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.client.disponibilidade_horario.update).not.toHaveBeenCalled();
  });
  it('deletes only the selected record and returns no data', async () => {
    expect(await service.delete(id)).toBeUndefined();
    expect(prisma.client.disponibilidade_horario.delete).toHaveBeenCalledWith({
      where: { id: id },
      select: { id: true },
    });
  });
  it('returns 404 for a missing delete target', async () => {
    prisma.client.disponibilidade_horario.delete.mockRejectedValue(
      knownError('P2025'),
    );
    await expect(service.delete(id)).rejects.toBeInstanceOf(NotFoundException);
  });
  it.each([
    ['P2002', ConflictException],
    ['P2003', ConflictException],
    ['P2000', BadRequestException],
    ['P2028', ServiceUnavailableException],
  ] as const)('sanitizes Prisma error %s', async (code, errorClass) => {
    prisma.client.disponibilidade_horario.create.mockRejectedValue(
      knownError(code),
    );
    await expect(service.create(sample)).rejects.toBeInstanceOf(errorClass);
  });
  it('sanitizes unexpected driver errors', async () => {
    prisma.client.disponibilidade_horario.findUnique.mockRejectedValue(
      new Error('private data'),
    );
    await expect(service.findById(id)).rejects.toThrow(
      'Operacao temporariamente indisponivel.',
    );
  });
  it('checks missing local professor_id before writes', async () => {
    prisma.client.professor.findUnique.mockResolvedValue(null);
    await expect(service.create(sample)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.client.disponibilidade_horario.create).not.toHaveBeenCalled();
    await expect(
      service.update(id, { professor_id: sample.professor_id }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.client.disponibilidade_horario.update).not.toHaveBeenCalled();
  });
  it('checks complete state on create and partial update', async () => {
    await expect(
      service.create({
        ...sample,
        hora_inicio: '12:00:00',
        hora_fim: '11:00:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update(id, { hora_fim: '07:00:00' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.client.disponibilidade_horario.update).not.toHaveBeenCalled();
  });
  it('detects optimistic concurrency conflicts', async () => {
    prisma.client.disponibilidade_horario.update.mockRejectedValue(
      knownError('P2025'),
    );
    await expect(service.update(id, patch)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
