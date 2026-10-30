import {
  mkdtempSync,
  readFileSync,
  unlinkSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Socket } from 'node:net';
import { exportOpenApi } from '../../../scripts/openapi/export.js';
it('exports and checks JSON with network connections forbidden', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gestao-openapi-'));
  const target = join(directory, 'contract.json');
  const network = vi
    .spyOn(Socket.prototype, 'connect')
    .mockImplementation(() => {
      throw new Error('Network forbidden during offline export');
    });
  try {
    expect(exportOpenApi([target])).toBe(69);
    expect(exportOpenApi([target], true)).toBe(69);
    const json = JSON.parse(readFileSync(target, 'utf8'));
    expect(json.paths['/auth/login']).toBeDefined();
    expect(network).not.toHaveBeenCalled();
    writeFileSync(target, '{}');
    expect(() => exportOpenApi([target], true)).toThrow(
      'OpenAPI desatualizado',
    );
  } finally {
    network.mockRestore();
    unlinkSync(target);
    rmdirSync(directory);
  }
});
