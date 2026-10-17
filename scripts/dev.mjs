// Режим разработки: пересборка клиента (esbuild --watch) + сервер с перезапуском (node --watch).
// Открывать http://localhost:4100 — клиент раздаёт тот же сервер.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = (relative) => fileURLToPath(new URL(relative, import.meta.url));

const processes = [
  ['client', ['build.mjs', '--watch'], dir('../client/')],
  ['server', ['--watch', '--env-file=.env', 'src/server.ts'], dir('../server/')],
].map(([name, args, cwd]) => {
  const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = (stream, out) =>
    stream.on('data', (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) out.write(`[${name}] ${line}\n`);
    });
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`[${name}] завершился с кодом ${code}`);
    shutdown();
  });
  return child;
});

function shutdown() {
  for (const child of processes) if (child.exitCode === null) child.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
