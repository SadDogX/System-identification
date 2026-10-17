// Сборка клиента одним esbuild: src/main.tsx → dist/app.js + dist/app.css, плюс index.html.
// node build.mjs           — сборка для продакшена (минифицированная)
// node build.mjs --watch   — пересборка при изменениях (для разработки)
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const watch = process.argv.includes('--watch');

await rm(path('dist'), { recursive: true, force: true });
await mkdir(path('dist'), { recursive: true });

const copyStatic = async () => {
  await copyFile(path('index.html'), path('dist/index.html'));
};

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [path('src/main.tsx')],
  outfile: path('dist/app.js'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  jsx: 'automatic',
  minify: !watch,
  sourcemap: watch,
  define: { 'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production') },
  logLevel: 'info',
  plugins: [
    {
      name: 'copy-static',
      setup(build) {
        build.onEnd(() => copyStatic().catch((err) => console.error(err)));
      },
    },
  ],
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
