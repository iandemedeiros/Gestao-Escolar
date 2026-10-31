import { copyFile, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const version = '5.33.1';
const text = await readFile(resolve(root, 'docs/openapi.json'), 'utf8');
const spec = JSON.parse(text);
assert.equal(spec.openapi, '3.0.3');
assert.ok(Object.keys(spec.paths).length > 0);
// Publication guard: fail without echoing potentially sensitive matches.
assert.ok(!/(?:mysql:\/\/|senha_hash|JWT_SECRET|INTERNAL_AUTH_TOKEN|SUPER_ADMIN_PASSWORD_HASH|-----BEGIN|\$argon2|admin67|batata123|https?:\/\/|localhost|127\.0\.0\.1|\/internal(?:\/|\b))/i.test(text), 'OpenAPI precisa de revisao: URL interna/externa ou marcador sensivel encontrado.');
function review(value) {
  if (!value || typeof value !== 'object') return;
  if (value.servers) for (const server of value.servers) assert.equal(server.url, '/', 'Servidor nao aprovado para publicacao.');
  if (value.$ref) assert.ok(value.$ref.startsWith('#/'), 'Referencia externa nao permitida.');
  for (const item of Object.values(value)) review(item);
}
review(spec);
const output = resolve(root, '.tmp/swagger-pages');
await mkdir(output, { recursive: true });
for (const name of ['index.html', 'site.css', 'swagger-init.js']) await copyFile(resolve(root, 'docs/swagger-ui', name), resolve(output, name));
await writeFile(resolve(output, 'openapi.json'), text);
for (const name of ['swagger-ui.css', 'swagger-ui-bundle.js']) {
  const response = await fetch(`https://raw.githubusercontent.com/swagger-api/swagger-ui/v${version}/dist/${name}`, { signal: AbortSignal.timeout(60000) });
  assert.ok(response.ok, `Nao foi possivel baixar ${name}.`);
  await writeFile(resolve(output, name), new Uint8Array(await response.arrayBuffer()));
}
// All links are relative; the same artifact works at /Gestao-Escolar/.
const html = await readFile(resolve(output, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) await readFile(resolve(output, match[1]));
assert.equal(new URL('./openapi.json', 'https://example.invalid/Gestao-Escolar/').pathname, '/Gestao-Escolar/openapi.json');
const init = await readFile(resolve(output, 'swagger-init.js'), 'utf8');
assert.ok(init.includes('supportedSubmitMethods: []'));
assert.ok(init.includes('validatorUrl: null'));
console.log(`Swagger UI ${version}: artefato estatico validado em .tmp/swagger-pages; OpenAPI revisado sem carregar ambiente ou backend.`);

assert.deepEqual((await readdir(output)).sort(), ['index.html','openapi.json','site.css','swagger-init.js','swagger-ui-bundle.js','swagger-ui.css'].sort(), 'Artefato contem arquivos inesperados.');
