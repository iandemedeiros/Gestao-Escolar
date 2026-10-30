import { exportOpenApi } from './openapi/export.js';
try {
  const check = process.argv.includes('--check');
  const count = exportOpenApi(undefined, check);
  console.log(
    `OpenAPI ${check ? 'atualizado' : 'gerado localmente'}: ${count} operacoes.`,
  );
} catch {
  console.error(
    'Falha na exportacao/validacao OpenAPI. Verifique os DTOs e execute npm.cmd run openapi:generate.',
  );
  process.exitCode = 1;
}
