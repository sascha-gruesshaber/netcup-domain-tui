import React from 'react';
import { render } from 'ink';
import { App } from './app/App.js';
import { NetcupClient } from './netcup/client.js';
import { configPath, loadConfig } from './config.js';

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  console.log(`netcup-dns – terminal UI for netcup DNS records

Usage: netcup-dns [--help] [--version]

Credentials are read from the environment (NETCUP_CUSTOMER_NUMBER, NETCUP_API_KEY,
NETCUP_API_PASSWORD) or from ${configPath()}.
Set NETCUP_DNS_CONFIG_DIR to use a different config directory.`);
  process.exit(0);
}
if (args.includes('--version') || args.includes('-v')) {
  console.log(process.env.NETCUP_DNS_VERSION ?? '0.1.0');
  process.exit(0);
}

const config = loadConfig();
/** Undocumented escape hatch used by `npm run demo` and tests to point the app at a mock server. */
const endpoint = process.env.NETCUP_API_ENDPOINT;
const { waitUntilExit } = render(
  <App config={config} configFile={configPath()} createClient={(creds) => new NetcupClient(creds, { endpoint })} />,
  { exitOnCtrlC: true },
);
await waitUntilExit();
