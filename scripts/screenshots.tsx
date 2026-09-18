/**
 * Renders the TUI against the mock API and writes SVG screenshots to docs/screenshots.
 * Run with: npm run screenshots
 */
process.env.FORCE_COLOR = '3';

const { render } = await import('ink-testing-library');
const React = (await import('react')).default;
const { App } = await import('../src/app/App.js');
const { NetcupClient } = await import('../src/netcup/client.js');
const { startMockServer, SAMPLE_ZONES } = await import('../tests/mock-server.js');
const { ansiToSvg } = await import('./ansi-to-svg.js');
const fs = await import('node:fs');

const ESC = String.fromCharCode(27);
const ENTER = '\r';
const DOWN = `${ESC}[B`;
const COLS = 100;

const server = await startMockServer(SAMPLE_ZONES);
const tick = (ms = 80) => new Promise((r) => setTimeout(r, ms));

const write = (name: string, frame: string, title: string) => {
  const trimmed = frame
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n');
  fs.mkdirSync('docs/screenshots', { recursive: true });
  fs.writeFileSync(`docs/screenshots/${name}.svg`, ansiToSvg(trimmed, { title, cols: COLS }));
  console.log(`wrote docs/screenshots/${name}.svg`);
};

const ui = render(
  <App
    config={{
      credentials: { customerNumber: '12345', apiKey: 'demo', apiPassword: 'secret' },
      extraDomains: ['example.dev'],
    }}
    configFile="~/.config/netcup-dns/config.json"
    createClient={(c) => new NetcupClient(c, { endpoint: server.url })}
    persist={() => undefined}
  />,
);

const press = async (...keys: string[]) => {
  for (const k of keys) {
    ui.stdin.write(k);
    await tick(20);
  }
};

await tick(150);
write('domains', ui.lastFrame()!, 'netcup-dns — domains');

await press(ENTER);
await tick(150);
write('records', ui.lastFrame()!, 'netcup-dns — example.com');

await press('n', ...'cloud', ENTER, ENTER, ...'203.0.113.77');
await tick(80);
write('new-record', ui.lastFrame()!, 'netcup-dns — new record');

await press(ENTER);
await tick(200);
await press(DOWN, DOWN, DOWN, DOWN, 'd');
await tick(80);
write('delete', ui.lastFrame()!, 'netcup-dns — delete confirmation');

ui.unmount();
await server.close();
