import { z } from 'zod';
import * as professor from '../../apps/professores/src/professores/dto.js';
import * as professorContact from '../../apps/professores/src/contatos/dto.js';
import * as availability from '../../apps/professores/src/disponibilidades/dto.js';
import * as turma from '../../apps/turmas-disciplinas/src/turmas/dto.js';
import * as discipline from '../../apps/turmas-disciplinas/src/disciplinas/dto.js';
import * as studentAllocation from '../../apps/turmas-disciplinas/src/alocacoes-alunos/dto.js';
import * as teacherAllocation from '../../apps/turmas-disciplinas/src/alocacoes-professores/dto.js';
import * as evaluation from '../../apps/avaliacoes-notas/src/avaliacoes/dto.js';
import * as grade from '../../apps/avaliacoes-notas/src/notas/dto.js';
import * as message from '../../apps/comunicacao/src/mensagens/dto.js';
import * as messageType from '../../apps/comunicacao/src/tipos-mensagem/dto.js';
import {
  createAlunoSchema,
  updateAlunoSchema,
} from '../../apps/alunos/src/alunos/dto/aluno-input.dto.js';
import {
  createContatoSchema,
  updateContatoSchema,
} from '../../apps/alunos/src/contatos/dto/contato.dto.js';

export const studentId = '123e4567-e89b-42d3-a456-426614174000';
export const teacherId = '123e4567-e89b-42d3-a456-426614174001';
export const disciplineId = '123e4567-e89b-42d3-a456-426614174002';
export const evaluationId = '123e4567-e89b-42d3-a456-426614174003';
export const contactId = '123e4567-e89b-42d3-a456-426614174004';
export type Role = 'SUPER_ADMIN' | 'PROFESSOR' | 'ALUNO';
const admin: Role[] = ['SUPER_ADMIN'],
  all: Role[] = ['SUPER_ADMIN', 'PROFESSOR', 'ALUNO'];
export interface Resource {
  name: string;
  path: string;
  tag: string;
  create: z.ZodType;
  patch: z.ZodType;
  createExample: Record<string, unknown>;
  patchExample: Record<string, unknown>;
  responseExample: Record<string, unknown>;
  nullable: string[];
  roles: {
    list: Role[];
    detail: Role[];
    create: Role[];
    patch: Role[];
    delete: Role[];
  };
  description: string;
  numeric?: boolean;
  noDetail?: boolean;
  blocked?: boolean;
  contact?: boolean;
  teacherCreate?: z.ZodType;
  assertState?: (value: never) => void;
}
const adminRoles = {
  list: admin,
  detail: admin,
  create: admin,
  patch: admin,
  delete: admin,
};
interface DtoModule {
  createSchema: z.ZodType;
  updateSchema: z.ZodType;
  select: Record<string, boolean>;
  toResponse: (row: never) => Record<string, unknown>;
}
function fromDto(
  name: string,
  path: string,
  tag: string,
  dto: DtoModule,
  example: Record<string, unknown>,
  patch: Record<string, unknown>,
  options: Partial<Resource> = {},
): Resource {
  const parsed = dto.createSchema.parse(example) as Record<string, unknown>;
  const row = Object.fromEntries(
    Object.keys(dto.select).map((key) => [
      key,
      key === 'id'
        ? options.numeric
          ? 1
          : studentId
        : key === 'dataEnvio'
          ? new Date('2026-11-01T12:00:00Z')
          : (parsed[key] ?? null),
    ]),
  );
  const responseExample = dto.toResponse(row as never);
  const resource: Resource = {
    name,
    path,
    tag,
    create: dto.createSchema,
    patch: dto.updateSchema,
    createExample: example,
    patchExample: patch,
    responseExample,
    nullable: [],
    roles: adminRoles,
    description:
      'Gerenciamento administrativo. Campos desconhecidos sao rejeitados.',
    ...options,
  };
  resource.assertState?.(parsed as never);
  return resource;
}
export const resources: Resource[] = [
  {
    name: 'Aluno',
    path: '/alunos',
    tag: 'Alunos',
    create: createAlunoSchema,
    patch: updateAlunoSchema,
    createExample: {
      nome: 'Aluno ficticio',
      data_nascimento: '2000-01-02',
      cpf: '11111111111',
      email: 'aluno@example.invalid',
      senha: 'senha-ficticia-123',
    },
    patchExample: { nome: 'Nome ficticio atualizado' },
    responseExample: {
      id: studentId,
      nome: 'Aluno ficticio',
      data_nascimento: '2000-01-02',
    },
    nullable: [],
    roles: { ...adminRoles, list: ['SUPER_ADMIN', 'PROFESSOR'], detail: all },
    description:
      'SUPER_ADMIN gerencia cadastros. PROFESSOR le somente ID e nome dos alunos de turmas autorizadas. ALUNO consulta apenas /alunos/{id} com o proprio sub. CPF normalizado para 11 digitos, sem verificadores; data de nascimento de 1900 ate hoje.',
  },
  {
    name: 'ContatoAluno',
    path: '/alunos/{alunoId}/contatos',
    tag: 'Alunos e contatos',
    create: createContatoSchema,
    patch: updateContatoSchema,
    createExample: { telefone: '5551234567' },
    patchExample: { celular: '5551234567' },
    responseExample: { id: contactId, aluno_id: studentId },
    nullable: [],
    noDetail: true,
    contact: true,
    roles: { ...adminRoles, list: ['SUPER_ADMIN', 'ALUNO'] },
    description:
      'SUPER_ADMIN gerencia; ALUNO lista somente contatos do proprio aluno. Nao existe GET individual de contato. Na criacao ao menos um telefone, celular ou e-mail nao nulo; PATCH pode limpar campos anulaveis. Respostas tem apenas IDs.',
  },
  fromDto(
    'Professor',
    '/professores',
    'Professores',
    professor,
    {
      nome: 'Professor ficticio',
      cpf: '11111111111',
      email: 'professor@example.invalid',
      senha: 'senha-ficticia-123',
      formacao: 'Formacao ficticia',
    },
    { formacao: null },
    {
      nullable: ['formacao'],
      roles: { ...adminRoles, detail: ['SUPER_ADMIN', 'PROFESSOR'] },
      description:
        'SUPER_ADMIN gerencia; PROFESSOR consulta apenas o proprio cadastro basico por ID. CPF aceita 11 digitos ou mascara e e normalizado para 14 caracteres. Privilegios administrativos nao sao editaveis.',
    },
  ),
  fromDto(
    'ContatoProfessor',
    '/contatos-professores',
    'Professores',
    professorContact,
    { professor_id: teacherId, telefone: '5551234567' },
    { celular: null },
    {
      contact: true,
      description:
        'Recurso administrativo. Valida professor local; criacao exige ao menos um telefone, celular ou e-mail nao nulo. Retorna somente IDs.',
    },
  ),
  fromDto(
    'Disponibilidade',
    '/disponibilidades-professores',
    'Professores',
    availability,
    {
      professor_id: teacherId,
      dia_semana: 'segunda',
      hora_inicio: '08:00:00',
      hora_fim: '10:00:00',
    },
    { hora_fim: '11:00:00' },
    {
      assertState: availability.assertState,
      description:
        'Somente SUPER_ADMIN. Horarios HH:mm:ss, fim posterior ao inicio, inclusive apos PATCH parcial. Dias sao texto, sem enum inventado. Mudanca concorrente pode retornar 409.',
    },
  ),
  fromDto(
    'Turma',
    '/turmas',
    'Turmas e disciplinas',
    turma,
    {
      nome: 'Turma ficticia',
      ano_letivo: 2026,
      turno: 'matutino',
      capacidade_maxima: 30,
    },
    { capacidade_maxima: 40 },
    {
      numeric: true,
      roles: { ...adminRoles, list: all, detail: all },
      description:
        'SUPER_ADMIN gerencia. PROFESSOR e ALUNO leem somente turmas relacionadas a seus vinculos. ID inteiro autoincrementado.',
    },
  ),
  fromDto(
    'Disciplina',
    '/disciplinas',
    'Turmas e disciplinas',
    discipline,
    { nome: 'Disciplina ficticia', carga_horaria: 60 },
    { carga_horaria: 80 },
    {
      roles: { ...adminRoles, list: all, detail: all },
      description:
        'SUPER_ADMIN gerencia. PROFESSOR le disciplinas em que esta alocado; ALUNO le as de suas matriculas.',
    },
  ),
  fromDto(
    'AlocacaoAluno',
    '/alocacoes-alunos',
    'Alocacoes',
    studentAllocation,
    { turma_id: 1, disciplina_id: disciplineId, aluno_id: studentId },
    { turma_id: 2 },
    {
      roles: { ...adminRoles, list: all, detail: all },
      description:
        'SUPER_ADMIN gerencia, validando aluno externo e referencias locais. PROFESSOR consulta vinculos das disciplinas autorizadas. ALUNO consulta somente os proprios. Nao existe FK entre bancos.',
    },
  ),
  fromDto(
    'AlocacaoProfessor',
    '/alocacoes-professores',
    'Alocacoes',
    teacherAllocation,
    { disciplina_id: disciplineId, professor_id: teacherId },
    { disciplina_id: evaluationId },
    {
      roles: {
        ...adminRoles,
        list: ['SUPER_ADMIN', 'PROFESSOR'],
        detail: ['SUPER_ADMIN', 'PROFESSOR'],
      },
      description:
        'SUPER_ADMIN gerencia, validando professor externo. PROFESSOR consulta apenas as proprias alocacoes. Nao implica vinculo direto professor-turma.',
    },
  ),
  fromDto(
    'Avaliacao',
    '/avaliacoes',
    'Avaliacoes e notas',
    evaluation,
    {
      turma_id: 1,
      disciplina_id: disciplineId,
      professor_id: teacherId,
      titulo: 'Avaliacao ficticia',
      tipo: 'prova',
      peso: '1.25',
      data_realizacao: '2026-11-10',
      data_entrega_final: '2026-11-10T18:00:00Z',
    },
    { peso: '2.50' },
    {
      nullable: ['entrega_do_aluno'],
      assertState: evaluation.assertState,
      teacherCreate: evaluation.createSchema.partial({ professor_id: true }),
      roles: {
        list: all,
        detail: all,
        create: ['SUPER_ADMIN', 'PROFESSOR'],
        patch: ['SUPER_ADMIN', 'PROFESSOR'],
        delete: admin,
      },
      description:
        'Professor cria/edita apenas suas avaliacoes em disciplina e turma autorizadas. Para PROFESSOR, professor_id pode ser omitido e sera o sub; outro professor e proibido. SUPER_ADMIN informa professor existente/alocado. Turma/disciplina/professor nao podem ser alterados depois da criacao (409). Prazo nao pode anteceder realizacao. ALUNO le por matricula e nao recebe entrega_do_aluno.',
    },
  ),
  fromDto(
    'Nota',
    '/notas',
    'Avaliacoes e notas',
    grade,
    { avaliacao_id: evaluationId, aluno_id: studentId, valor_obtido: '8.50' },
    { valor_obtido: '9.00' },
    {
      nullable: ['media_calculada'],
      roles: {
        list: all,
        detail: all,
        create: ['SUPER_ADMIN', 'PROFESSOR'],
        patch: ['SUPER_ADMIN', 'PROFESSOR'],
        delete: admin,
      },
      description:
        'Professor lanca/edita apenas nas proprias avaliacoes autorizadas e para alunos matriculados na turma/disciplina exatas. ALUNO consulta somente suas notas. Avaliacao/aluno de nota criada sao imutaveis (409). Media e somente leitura e nao tem calculo automatico. Decimais de 0 a 999.99, ate duas casas; nao ha escala academica definitiva.',
    },
  ),
  fromDto(
    'Mensagem',
    '/mensagens',
    'Mensagens - bloqueado',
    message,
    {
      remetenteId: teacherId,
      destinatarioId: studentId,
      tipoId: disciplineId,
      conteudo: 'Mensagem ficticia',
    },
    { conteudo: 'Texto ficticio atualizado' },
    {
      blocked: true,
      roles: { list: [], detail: [], create: [], patch: [], delete: [] },
      description:
        'BLOQUEADO para todos os perfis: o schema nao identifica com seguranca os dominios de remetente/destinatario. Rotas existem, mas sempre retornam 403 com JWT valido. Corpo e resposta sao apenas contrato reservado; nenhuma operacao de sucesso esta disponivel.',
    },
  ),
  fromDto(
    'TipoMensagem',
    '/tipos-mensagem',
    'Tipos de mensagem',
    messageType,
    { nome: 'Tipo ficticio', descricao: 'Descricao ficticia' },
    { descricao: null },
    {
      nullable: ['descricao'],
      description:
        'Somente SUPER_ADMIN. Exclusao de tipo referenciado por mensagem retorna conflito 409.',
    },
  ),
];
for (const resource of resources) {
  resource.create.parse(resource.createExample);
  resource.patch.parse(resource.patchExample);
}
