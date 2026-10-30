import { hash, argon2id } from 'argon2';
import { emitKeypressEvents } from 'node:readline';

// Interactive input is hidden. Never accept a password on the command line.
async function readPassword() {
  if (process.stdin.isTTY) {
    process.stderr.write('Senha (entrada oculta): ');
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    return new Promise((resolve, reject) => {
      let value = '';
      const finish = (aborted = false) => {
        process.stdin.removeListener('keypress', onKey);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stderr.write('\n');
        if (aborted) reject(new Error('cancelled'));
        else resolve(value);
      };
      const onKey = (text, key) => {
        if (key.ctrl && key.name === 'c') return finish(true);
        if (key.name === 'return' || key.name === 'enter') return finish();
        if (key.name === 'backspace') {
          value = Array.from(value).slice(0, -1).join('');
          return;
        }
        if (text && !key.ctrl && !key.meta) value += text;
        if (value.length > 128) finish(true);
      };
      process.stdin.on('keypress', onKey);
    });
  }
  let value = '';
  for await (const chunk of process.stdin) {
    value += chunk;
    if (value.length > 1024) throw new Error('input too long');
  }
  return value.replace(/\r?\n$/, '');
}

try {
  if (process.argv.length !== 2) throw new Error('arguments not supported');
  const value = await readPassword();
  if (!value || value.length > 128) throw new Error('invalid input');
  console.log(
    await hash(value, {
      type: argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    }),
  );
} catch {
  console.error('Nao foi possivel gerar o hash.');
  process.exitCode = 1;
}
