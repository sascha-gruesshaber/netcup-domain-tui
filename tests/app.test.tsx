import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../src/app/App.js';
import { NetcupClient } from '../src/netcup/client.js';
import { startMockServer, SAMPLE_ZONES, type MockServer } from './mock-server.js';

let server: MockServer;
const creds = { customerNumber: '12345', apiKey: 'key', apiPassword: 'secret' };
const ENTER = '\r';
const ESC = '\u001B';
const DOWN = '\u001B[B';
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
/** Ink parses each stdin chunk as one key press, so keys must be written one at a time. */
async function press(stdin: { write: (s: string) => void }, ...keys: string[]) {
  for (const k of keys) {
    stdin.write(k);
    await tick(15);
  }
}

before(async () => {
  server = await startMockServer(SAMPLE_ZONES);
});
after(async () => {
  await server.close();
});

function mount() {
  const saved: unknown[] = [];
  const ui = render(
    <App
      config={{ credentials: creds, extraDomains: [] }}
      configFile="/tmp/config.json"
      createClient={(c) => new NetcupClient(c, { endpoint: server.url })}
      persist={(cfg) => saved.push(cfg)}
    />,
  );
  return { ...ui, saved };
}

test('shows domains, opens a zone, creates and deletes a record', async () => {
  const { lastFrame, stdin, saved, unmount } = mount();
  await tick();
  assert.match(lastFrame()!, /example\.com/);
  assert.match(lastFrame()!, /Loaded 3 domain/);

  stdin.write(ENTER); // open example.com
  await tick();
  assert.match(lastFrame()!, /HOSTNAME/);
  assert.match(lastFrame()!, /home\s+A\s+198\.51\.100\.42/);
  assert.match(lastFrame()!, /TTL 3600/);

  stdin.write('n'); // new record form
  await tick();
  assert.match(lastFrame()!, /New record/);
  stdin.write('cloud');
  await tick(20);
  stdin.write(ENTER); // -> type (A stays)
  await tick(20);
  stdin.write(ENTER); // -> destination
  await tick(20);
  stdin.write('203.0.113.77');
  await tick(20);
  stdin.write(ENTER); // save
  await tick(100);
  assert.match(lastFrame()!, /Saved cloud A → 203\.0\.113\.77/);
  assert.match(lastFrame()!, /cloud\s+A\s+203\.0\.113\.77/);
  assert.ok(server.state.domains['example.com'].some((r) => r.hostname === 'cloud'));

  // rows are sorted: @ A, @ AAAA, @ MX, @ TXT, cloud, home, www -> move to "cloud"
  await press(stdin, DOWN, DOWN, DOWN, DOWN);
  stdin.write('d');
  await tick(20);
  assert.match(lastFrame()!, /Delete this record/);
  assert.match(lastFrame()!, /cloud\s+A\s+203\.0\.113\.77/);
  stdin.write('y');
  await tick(100);
  assert.match(lastFrame()!, /Deleted cloud/);
  assert.ok(!server.state.domains['example.com'].some((r) => r.hostname === 'cloud'));

  stdin.write(ESC); // back to domains
  await tick(20);
  assert.match(lastFrame()!, /Domains/);
  assert.equal(saved.length, 0);
  unmount();
});

test('validation blocks an A record with a bad address', async () => {
  const { lastFrame, stdin, unmount } = mount();
  await tick();
  await press(stdin, DOWN, DOWN, ENTER); // example.org
  await tick();
  stdin.write('n');
  await tick(20);
  await press(stdin, 'x', ENTER, ENTER, 'not-an-ip', ENTER);
  await tick(50);
  assert.match(lastFrame()!, /A records need an IPv4 address/);
  unmount();
});
