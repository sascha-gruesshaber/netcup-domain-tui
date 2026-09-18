/**
 * Runs the TUI against an in-memory mock of the netcup API.
 * Handy for trying the UI without touching real DNS zones: `npm run demo`.
 */
import { spawn } from 'node:child_process';
import { startMockServer, SAMPLE_ZONES } from '../tests/mock-server.js';

const server = await startMockServer(SAMPLE_ZONES);
const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.tsx'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NETCUP_API_ENDPOINT: server.url,
    NETCUP_CUSTOMER_NUMBER: '12345',
    NETCUP_API_KEY: 'demo-key',
    NETCUP_API_PASSWORD: 'secret',
  },
});
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
