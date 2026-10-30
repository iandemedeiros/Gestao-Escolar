import { readFileSync } from 'node:fs';
import {
  buildDocument,
  operationCount,
} from '../../../scripts/openapi/document.js';
import { resources } from '../../../scripts/openapi/resources.js';
import { frontendOrigins } from '../src/openapi/setup.js';
const document = buildDocument();
const schemas = document.components!.schemas!;
it('exports the complete offline contract and both tracked artifacts', () => {
  expect(operationCount(document)).toBe(69);
  for (const path of [
    'docs/openapi.json',
    'apps/api-gateway/src/openapi/public-contract.json',
  ]) {
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(document);
  }
  expect(
    Object.keys(document.paths).some(
      (path) => path.includes('internal') || path.includes('*'),
    ),
  ).toBe(false);
});
it.each(resources)(
  'documents concrete inputs, output projection and permissions: $name',
  (resource) => {
    const create = schemas[resource.name + 'Create'];
    const response = schemas[resource.name + 'Response'];
    expect(create).toBeDefined();
    expect(response).toHaveProperty('additionalProperties', false);
    expect(
      Object.keys(('properties' in response ? response.properties : {})!),
    ).toEqual(Object.keys(resource.responseExample));
    expect(resource.create.safeParse(resource.createExample).success).toBe(
      true,
    );
    expect(resource.patch.safeParse(resource.patchExample).success).toBe(true);
    expect(
      resource.create.safeParse({
        ...resource.createExample,
        campo_desconhecido: true,
      }).success,
    ).toBe(false);
    const path = document.paths[resource.path]!;
    expect(path.post!.security).toEqual([{ bearer: [] }]);
    expect(path.post).toHaveProperty('x-roles', resource.roles.create);
    if (resource.blocked) {
      expect(path.post!.deprecated).toBe(true);
      expect(Object.keys(path.post!.responses)).toEqual(['401', '403', '503']);
    }
  },
);
it('keeps secrets out of the specification even with backend environment configured', () => {
  vi.stubEnv('JWT_SECRET', 'SECRET_SENTINEL');
  vi.stubEnv('INTERNAL_AUTH_TOKEN', 'INTERNAL_SENTINEL');
  try {
    const text = JSON.stringify(buildDocument());
    for (const secret of [
      'SECRET_SENTINEL',
      'INTERNAL_SENTINEL',
      'senha_hash',
      'JWT_SECRET',
      'INTERNAL_AUTH_TOKEN',
      'batata123',
      'admin67',
    ])
      expect(text).not.toContain(secret);
    expect(document.components!.securitySchemes).toHaveProperty('bearer', {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: expect.any(String),
    });
    expect(document.paths['/auth/login']!.post!.security).toEqual([]);
  } finally {
    vi.unstubAllEnvs();
  }
});
it('normalizes explicit origins and defaults to no cross-origin frontend', () => {
  expect(frontendOrigins('')).toEqual([]);
  expect(
    frontendOrigins(
      'http://localhost:4200/, http://localhost:5173,http://localhost:4200',
    ),
  ).toEqual(['http://localhost:4200', 'http://localhost:5173']);
});
it.each([
  '*',
  'https://*.example.org',
  'null',
  'file:///foo',
  'https://user:pass@example.org',
  'https://example.org/path',
  'https://example.org?query=1',
  'https://example.org#hash',
])('rejects unsafe origin %s', (origin) => {
  expect(() => frontendOrigins(origin)).toThrow('FRONTEND_ORIGINS');
});

it.each([
  '/alunos',
  '/professores',
  '/contatos-professores',
  '/disponibilidades-professores',
  '/turmas',
  '/disciplinas',
  '/alocacoes-alunos',
  '/alocacoes-professores',
  '/avaliacoes',
  '/notas',
  '/mensagens',
  '/tipos-mensagem',
])('covers each real CRUD path %s', (path) => {
  expect(Object.keys(document.paths[path]!)).toEqual(['get', 'post']);
  expect(Object.keys(document.paths[path + '/{id}']!)).toEqual([
    'get',
    'patch',
    'delete',
  ]);
});
it('documents the nested contact exception and real pagination bounds', () => {
  expect(Object.keys(document.paths['/alunos/{alunoId}/contatos']!)).toEqual([
    'get',
    'post',
  ]);
  expect(
    Object.keys(document.paths['/alunos/{alunoId}/contatos/{contatoId}']!),
  ).toEqual(['patch', 'delete']);
  const parameters = document.paths['/alunos']!.get!.parameters;
  expect(parameters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: 'limit',
        schema: expect.objectContaining({ default: 20, maximum: 100 }),
      }),
      expect.objectContaining({
        name: 'page',
        schema: expect.objectContaining({ default: 1, maximum: 10000 }),
      }),
    ]),
  );
});
it('expresses decimal bounds and nullable response fields', () => {
  const create = schemas.NotaCreate as import('@nestjs/swagger').SchemaObject;
  const decimal = create.properties!
    .valor_obtido as import('@nestjs/swagger').SchemaObject;
  const pattern = (decimal.anyOf![0] as import('@nestjs/swagger').SchemaObject)
    .pattern!;
  for (const value of ['0', '8.50', '999.99'])
    expect(new RegExp(pattern).test(value)).toBe(true);
  for (const value of ['-1', '1000', '8.555', 'abc'])
    expect(new RegExp(pattern).test(value)).toBe(false);
  expect(schemas.NotaResponse).toHaveProperty(
    'properties.media_calculada.nullable',
    true,
  );
  expect(schemas.AlunoPatch).toHaveProperty('minProperties', 1);
});
