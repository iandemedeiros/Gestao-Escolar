import {
  DocumentBuilder,
  type OpenAPIObject,
  type SchemaObject,
  type ReferenceObject,
} from '@nestjs/swagger';
import { z } from 'zod';
import { resources, studentId, type Resource } from './resources.js';
import {
  loginSchema,
  changeSchema,
} from '../../apps/api-gateway/src/auth/auth.dto.js';
import { paginationSchema } from '../../apps/alunos/src/common/pagination.dto.js';
import { AppService } from '../../apps/api-gateway/src/app.service.js';

type Operation = Record<string, unknown>;
const uuid = { type: 'string', format: 'uuid' } as SchemaObject;
const ref = (name: string) => ({ $ref: '#/components/schemas/' + name });

function converted(
  schema: z.ZodType,
  io: 'input' | 'output' = 'input',
): SchemaObject {
  const result = z.toJSONSchema(schema, {
    io,
    target: 'openapi-3.0',
    unrepresentable: 'throw',
  }) as SchemaObject;
  delete (result as Record<string, unknown>).$schema;
  markPasswords(result);
  return result;
}
function markPasswords(schema: SchemaObject) {
  for (const [key, value] of Object.entries(schema.properties ?? {})) {
    if (key === 'senha' || key === 'senha_atual' || key === 'nova_senha')
      Object.assign(value, { format: 'password', writeOnly: true });
    markPasswords(value as SchemaObject);
  }
  for (const child of [...(schema.anyOf ?? []), ...(schema.oneOf ?? [])])
    markPasswords(child as SchemaObject);
}
function requestSchema(
  schema: z.ZodType,
  patch = false,
  contact = false,
): SchemaObject {
  const result = converted(schema);
  if (patch) result.minProperties = 1;
  if (contact && !patch)
    result.anyOf = ['telefone', 'celular', 'email'].map((field) => ({
      required: [field],
      properties: { [field]: { type: 'string' } },
    }));
  for (const [key, field] of Object.entries(result.properties ?? {})) {
    const property = field as SchemaObject;
    if (['data_nascimento', 'data_realizacao'].includes(key))
      Object.assign(property, {
        format: 'date',
        description:
          key === 'data_nascimento'
            ? 'Data real entre 1900 e hoje.'
            : 'Data real YYYY-MM-DD, ano entre 1000 e 9999.',
      });
    if (['hora_inicio', 'hora_fim'].includes(key))
      property.description =
        'HH:mm:ss; hora_fim deve ser posterior a hora_inicio.';
    if (['peso', 'valor_obtido'].includes(key)) {
      const positive = key === 'peso';
      Object.assign(property, {
        anyOf: [
          {
            type: 'string',
            pattern:
              (positive ? '^(?!0(?:\\.0{1,2})?$)' : '^') +
              '(?:0|[1-9][0-9]{0,2})(?:\\.[0-9]{1,2})?$',
          },
          {
            type: 'number',
            minimum: 0,
            exclusiveMinimum: positive,
            maximum: 999.99,
            multipleOf: 0.01,
          },
        ],
        description:
          'Decimal com ate duas casas e maximo 999.99; resposta usa string com duas casas.',
      });
    }
  }
  return result;
}
function responseSchema(resource: Resource): SchemaObject {
  const properties: Record<string, SchemaObject> = {};
  for (const [key, value] of Object.entries(resource.responseExample)) {
    let field: SchemaObject;
    if ((key === 'id' && resource.numeric) || key === 'turma_id')
      field = { type: 'integer', format: 'int32', minimum: 1 };
    else if (key === 'id' || key.endsWith('_id') || key.endsWith('Id'))
      field = { ...uuid };
    else if (typeof value === 'number') field = { type: 'integer' };
    else if (['data_nascimento', 'data_realizacao'].includes(key))
      field = { type: 'string', format: 'date' };
    else if (
      ['dataEnvio', 'data_entrega_final', 'entrega_do_aluno'].includes(key)
    )
      field = { type: 'string', format: 'date-time' };
    else if (['hora_inicio', 'hora_fim'].includes(key))
      field = {
        type: 'string',
        pattern: '^(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
      };
    else if (['peso', 'valor_obtido', 'media_calculada'].includes(key))
      field = { type: 'string', pattern: '^[0-9]{1,3}\\.[0-9]{2}$' };
    else field = { type: 'string' };
    if (resource.nullable.includes(key)) field.nullable = true;
    properties[key] = field;
  }
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}
function page(item: SchemaObject | ReferenceObject): SchemaObject {
  return {
    type: 'object',
    properties: {
      data: { type: 'array', items: item },
      page: { type: 'integer', minimum: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
      total: { type: 'integer', minimum: 0 },
    },
    required: ['data', 'page', 'limit', 'total'],
    additionalProperties: false,
  };
}
const errors: Record<number, string> = {
  400: 'Entrada invalida.',
  401: 'Nao autenticado.',
  403: 'Acesso negado.',
  404: 'Registro nao encontrado.',
  409: 'Conflito nos dados.',
  429: 'Tente novamente mais tarde.',
  503: 'Servico indisponivel.',
};
function errorResponse(code: number) {
  return {
    description: errors[code],
    content: {
      'application/json': {
        schema: ref('Erro'),
        example: { statusCode: code, message: errors[code] },
      },
    },
  };
}
function pathParameters(path: string, numeric = false) {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1],
    in: 'path',
    required: true,
    description:
      match[1] === 'id' && numeric
        ? 'ID inteiro positivo autoincrementado.'
        : 'UUID do recurso; identidade e permissoes sao verificadas pelo JWT.',
    schema:
      match[1] === 'id' && numeric
        ? { type: 'integer', minimum: 1, maximum: 2147483647 }
        : { ...uuid },
    example: match[1] === 'id' && numeric ? 1 : studentId,
  }));
}
export function operationCount(document: OpenAPIObject) {
  return Object.values(document.paths).reduce(
    (total, item) =>
      total +
      Object.keys(item ?? {}).filter((key) =>
        ['get', 'post', 'patch', 'delete', 'put', 'head', 'options'].includes(
          key,
        ),
      ).length,
    0,
  );
}
export function buildDocument(): OpenAPIObject {
  const base = new DocumentBuilder()
    .setTitle('Gestao Escolar - API Gateway')
    .setDescription(
      'Contratos publicos para integracao frontend. Identidade vem do JWT, nunca do corpo. Exemplos sao ficticios. Mensagens estao bloqueadas. Nao execute mutacoes em bancos compartilhados sem autorizacao.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Cole apenas o token recebido no login; expira em 900 segundos.',
      },
      'bearer',
    )
    .build();
  const schemas: Record<string, SchemaObject> = {
    Erro: {
      type: 'object',
      properties: {
        statusCode: { type: 'integer' },
        message: { type: 'string' },
        error: { type: 'string' },
      },
      required: ['statusCode', 'message'],
      additionalProperties: false,
    },
  };
  const principal = z.discriminatedUnion('role', [
    z.strictObject({
      sub: z.literal('super-admin'),
      role: z.literal('SUPER_ADMIN'),
    }),
    z.strictObject({ sub: z.uuid(), role: z.literal('PROFESSOR') }),
    z.strictObject({ sub: z.uuid(), role: z.literal('ALUNO') }),
  ]);
  schemas.Principal = converted(principal);
  schemas.LoginInput = requestSchema(loginSchema);
  schemas.ChangePasswordInput = requestSchema(changeSchema);
  schemas.LoginResponse = {
    type: 'object',
    properties: {
      access_token: {
        type: 'string',
        description: 'JWT; tratar como credencial, sem registrar em logs.',
      },
      token_type: { type: 'string', enum: ['Bearer'] },
      expires_in: { type: 'integer', enum: [900] },
      user: ref('Principal'),
    },
    required: ['access_token', 'token_type', 'expires_in', 'user'],
    additionalProperties: false,
  };
  schemas.PasswordChanged = {
    type: 'object',
    properties: { message: { type: 'string', enum: ['Senha atualizada.'] } },
    required: ['message'],
    additionalProperties: false,
  };
  const paths: Record<string, Record<string, Operation>> = {};
  const bearer = [{ bearer: [] }];
  const pagination = converted(paginationSchema, 'output');
  const queryParameters = ['page', 'limit'].map((name) => ({
    name,
    in: 'query',
    required: false,
    description:
      name === 'page'
        ? 'Pagina (1 a 10000). Nao repetir parametros.'
        : 'Limite padrao 20, maximo 100. Outros filtros sao rejeitados.',
    schema: pagination.properties?.[name],
  }));
  for (const resource of resources) {
    const name = resource.name;
    schemas[name + 'Create'] = requestSchema(
      resource.create,
      false,
      resource.contact,
    );
    schemas[name + 'Patch'] = requestSchema(
      resource.patch,
      true,
      resource.contact,
    );
    schemas[name + 'Response'] = responseSchema(resource);
    if (resource.teacherCreate)
      schemas[name + 'Create'] = {
        anyOf: [
          schemas[name + 'Create'],
          requestSchema(resource.teacherCreate),
        ],
        description:
          'SUPER_ADMIN informa professor_id. PROFESSOR pode omitir esse campo, derivado do JWT; nao pode escolher outro professor.',
      };
    schemas[name + 'Page'] = page(ref(name + 'Response'));
    let detailSchema: SchemaObject | ReferenceObject = ref(name + 'Response'),
      listSchema: SchemaObject | ReferenceObject = ref(name + 'Page');
    if (name === 'Aluno') {
      schemas.AlunoProfessorResponse = {
        type: 'object',
        properties: { id: { ...uuid }, nome: { type: 'string' } },
        required: ['id', 'nome'],
        additionalProperties: false,
      };
      schemas.AlunoProfessorPage = page(ref('AlunoProfessorResponse'));
      detailSchema = {
        anyOf: [ref('AlunoResponse'), ref('AlunoProfessorResponse')],
      };
      listSchema = { anyOf: [ref('AlunoPage'), ref('AlunoProfessorPage')] };
    }
    if (name === 'Avaliacao') {
      const properties = { ...schemas.AvaliacaoResponse.properties };
      delete properties.entrega_do_aluno;
      schemas.AvaliacaoAlunoResponse = {
        ...schemas.AvaliacaoResponse,
        properties,
        required: schemas.AvaliacaoResponse.required?.filter(
          (key) => key !== 'entrega_do_aluno',
        ),
      };
      schemas.AvaliacaoAlunoPage = page(ref('AvaliacaoAlunoResponse'));
      detailSchema = {
        anyOf: [ref('AvaliacaoResponse'), ref('AvaliacaoAlunoResponse')],
      };
      listSchema = { anyOf: [ref('AvaliacaoPage'), ref('AvaliacaoAlunoPage')] };
    }
    const detail =
      resource.path + '/{' + (resource.noDetail ? 'contatoId' : 'id') + '}';
    const actions = [
      { action: 'list', method: 'get', path: resource.path },
      ...(!resource.noDetail
        ? [{ action: 'detail', method: 'get', path: detail }]
        : []),
      { action: 'create', method: 'post', path: resource.path },
      { action: 'patch', method: 'patch', path: detail },
      { action: 'delete', method: 'delete', path: detail },
    ] as const;
    for (const { action, method, path } of actions) {
      const allowed = resource.roles[action as keyof Resource['roles']];
      const description =
        resource.description +
        ' Perfis permitidos: ' +
        (allowed.length ? allowed.join(', ') : 'nenhum, recurso bloqueado') +
        '. Paginas e contagens sao limitadas ao escopo autorizado. Exclusoes administrativas podem respeitar cascatas/restricoes existentes.';
      const operation: Operation = {
        operationId: name + '_' + action,
        tags: [resource.tag],
        summary:
          (resource.blocked ? '[BLOQUEADO] ' : '') +
          {
            list: 'Listar ',
            detail: 'Consultar ',
            create: 'Criar ',
            patch: 'Atualizar ',
            delete: 'Excluir ',
          }[action] +
          name,
        description,
        security: bearer,
        parameters: [
          ...pathParameters(path, resource.numeric),
          ...(action === 'list' ? queryParameters : []),
        ],
        'x-roles': allowed,
        'x-available': !resource.blocked,
        ...(resource.blocked ? { deprecated: true } : {}),
      };
      if (action === 'create' || action === 'patch') {
        const examples: Record<string, { summary: string; value: unknown }> = {
          padrao: {
            summary: 'Dados ficticios',
            value:
              action === 'create'
                ? resource.createExample
                : resource.patchExample,
          },
        };
        if (action === 'create' && resource.teacherCreate) {
          const { professor_id: _professor, ...example } =
            resource.createExample;
          resource.teacherCreate.parse(example);
          examples.professor = {
            summary: 'Professor: identidade derivada do JWT',
            value: example,
          };
        }
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: ref(name + (action === 'create' ? 'Create' : 'Patch')),
              examples,
            },
          },
        };
      }
      const responses: Record<string, unknown> = {};
      if (resource.blocked) {
        responses['401'] = errorResponse(401);
        responses['503'] = errorResponse(503);
        responses['403'] = {
          ...errorResponse(403),
          description:
            'Sempre bloqueado para todos os perfis autenticados nesta etapa.',
        };
      } else {
        const status =
          action === 'create' ? 201 : action === 'delete' ? 204 : 200;
        responses[status] =
          action === 'delete'
            ? { description: 'Excluido; resposta sem corpo.' }
            : {
                description: 'Operacao autorizada.',
                content: {
                  'application/json': {
                    schema: action === 'list' ? listSchema : detailSchema,
                    example:
                      action === 'list'
                        ? {
                            data: [resource.responseExample],
                            page: 1,
                            limit: 20,
                            total: 1,
                          }
                        : resource.responseExample,
                  },
                },
              };
        for (const code of [
          400,
          401,
          403,
          ...(action === 'list' ? [] : [404]),
          ...(['create', 'patch', 'delete'].includes(action) ? [409] : []),
          503,
        ])
          responses[code] = errorResponse(code);
      }
      operation.responses = responses;
      (paths[path] ??= {})[method] = operation;
    }
  }
  const loginExamples = {
    aluno: {
      summary: 'Aluno: perfil determinado pelo backend',
      value: { cpf: '111.111.111-11', senha: 'senha-ficticia-123' },
    },
    professor: {
      summary: 'Professor: mesmo formato, sem escolher role',
      value: { cpf: '222.222.222-22', senha: 'senha-ficticia-123' },
    },
    superAdmin: {
      summary: 'Conta local configurada pelo responsavel',
      value: { usuario: 'operador-ficticio', senha: 'senha-ficticia-123' },
    },
  };
  for (const example of Object.values(loginExamples))
    loginSchema.parse(example.value);
  paths['/auth/login'] = {
    post: {
      operationId: 'Auth_login',
      tags: ['Autenticacao'],
      summary: 'Autenticar aluno, professor ou conta local',
      description:
        'Nao aceita role, sub ou ID. Perfil vem das credenciais verificadas. CPF/senha presente nos dois dominios e recusado por ambiguidade. Limite de 10 tentativas/minuto/IP em memoria; dados incorretos retornam 401 generico.',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: ref('LoginInput'),
            examples: loginExamples,
          },
        },
      },
      responses: {
        200: {
          description: 'JWT valido por 15 minutos.',
          content: {
            'application/json': {
              schema: ref('LoginResponse'),
              example: {
                access_token: 'TOKEN_FICTICIO_DO_LOGIN',
                token_type: 'Bearer',
                expires_in: 900,
                user: { sub: studentId, role: 'ALUNO' },
              },
            },
          },
        },
        400: errorResponse(400),
        401: {
          ...errorResponse(401),
          description:
            'Credenciais invalidas, sem identificar CPF existente ou senha incorreta.',
        },
        429: errorResponse(429),
        503: errorResponse(503),
      },
    },
  };
  paths['/auth/me'] = {
    get: {
      operationId: 'Auth_me',
      tags: ['Autenticacao'],
      summary: 'Consultar identidade assinada',
      description:
        'Retorna somente sub e role do JWT, sem consultar o estado atual da conta. Token ausente, invalido ou expirado retorna 401.',
      security: bearer,
      'x-roles': ['SUPER_ADMIN', 'PROFESSOR', 'ALUNO'],
      responses: {
        200: {
          description: 'Identidade autenticada.',
          content: {
            'application/json': {
              schema: ref('Principal'),
              example: { sub: studentId, role: 'ALUNO' },
            },
          },
        },
        401: errorResponse(401),
      },
    },
  };
  const passwordExample = {
    senha_atual: 'senha-ficticia-atual',
    nova_senha: 'senha-ficticia-nova',
  };
  changeSchema.parse(passwordExample);
  paths['/auth/change-password'] = {
    post: {
      operationId: 'Auth_changePassword',
      tags: ['Autenticacao'],
      summary: 'Trocar a propria senha',
      description:
        'Somente ALUNO/PROFESSOR. ID vem do JWT; confirma senha atual e gera novo hash. Nao aceita ID arbitrario. Tokens anteriores continuam validos ate expirar. Conta administrativa local nao usa esta rota. Nao executar em banco compartilhado sem permissao de escrita.',
      security: bearer,
      'x-roles': ['ALUNO', 'PROFESSOR'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: ref('ChangePasswordInput'),
            example: passwordExample,
          },
        },
      },
      responses: {
        200: {
          description: 'Senha atualizada.',
          content: {
            'application/json': {
              schema: ref('PasswordChanged'),
              example: { message: 'Senha atualizada.' },
            },
          },
        },
        400: errorResponse(400),
        401: errorResponse(401),
        403: errorResponse(403),
        409: errorResponse(409),
        429: errorResponse(429),
        503: errorResponse(503),
      },
    },
  };
  paths['/health'] = {
    get: {
      operationId: 'Gateway_health',
      tags: ['Status'],
      summary: 'Verificar disponibilidade da Gateway',
      description:
        'Publico; nao depende dos bancos nem verifica disponibilidade dos outros servicos.',
      security: [],
      responses: {
        200: {
          description: 'Gateway respondendo.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  service: { type: 'string', enum: ['api-gateway'] },
                  status: { type: 'string', enum: ['ok'] },
                },
                required: ['service', 'status'],
                additionalProperties: false,
              },
              example: { service: 'api-gateway', status: 'ok' },
            },
          },
        },
      },
    },
  };
  paths['/'] = {
    get: {
      operationId: 'Gateway_root',
      tags: ['Status'],
      summary: 'Rota textual de compatibilidade',
      description:
        'Resposta textual legada; para health estruturado use /health.',
      security: [],
      responses: {
        200: {
          description: 'Texto de compatibilidade.',
          content: {
            'text/html': {
              schema: { type: 'string' },
              example: new AppService().getHello(),
            },
          },
        },
      },
    },
  };
  return {
    ...base,
    openapi: '3.0.3',
    servers: [
      {
        url: '/',
        description:
          'Origem atual da Gateway; configure baseURL no cliente externo.',
      },
    ],
    paths: paths as OpenAPIObject['paths'],
    components: { ...base.components, schemas },
    tags: [
      ...new Set(resources.map((resource) => resource.tag)),
      'Autenticacao',
      'Status',
    ].map((name) => ({ name })),
  };
}
