import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** Ink only loads react-devtools-core when DEV=true; replace it with an empty module. */
const stubDevtools = {
  name: 'stub-react-devtools',
  setup(b) {
    b.onResolve({ filter: /^react-devtools-core$/ }, (args) => ({ path: args.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default {};', loader: 'js' }));
  },
};

await build({
  entryPoints: ['src/index.tsx'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/netcup-dns.mjs',
  banner: {
    js: [
      '#!/usr/bin/env node',
      "import { createRequire as __createRequire } from 'node:module';",
      'const require = __createRequire(import.meta.url);',
    ].join('\n'),
  },
  define: { 'process.env.NETCUP_DNS_VERSION': JSON.stringify(pkg.version), 'process.env.DEV': '"false"' },
  plugins: [stubDevtools],
  logLevel: 'warning',
});
