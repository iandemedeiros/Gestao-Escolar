import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildDocument, operationCount } from './document.js';
export const outputPaths = [
  'docs/openapi.json',
  'apps/api-gateway/src/openapi/public-contract.json',
];

// This offline path imports only DTOs/mappers, never modules or PrismaService.
export function exportOpenApi(paths = outputPaths, check = false) {
  const document = buildDocument();
  const serialized = JSON.stringify(document, null, 2) + '\n';
  if (check) {
    if (
      paths.some(
        (path) =>
          !existsSync(path) || readFileSync(path, 'utf8') !== serialized,
      )
    ) {
      throw new Error(
        'OpenAPI desatualizado: execute npm.cmd run openapi:generate.',
      );
    }
  } else {
    for (const path of paths) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, serialized);
    }
  }
  return operationCount(document);
}
