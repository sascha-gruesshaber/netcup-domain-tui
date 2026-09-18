import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { NetcupClient, isResellerOnlyError } from '../src/netcup/client.js';
import { NetcupApiError } from '../src/netcup/types.js';
import { startMockServer, SAMPLE_ZONES, type MockServer } from './mock-server.js';

let server: MockServer;
const creds = { customerNumber: '12345', apiKey: 'key', apiPassword: 'secret' };

before(async () => {
  server = await startMockServer(SAMPLE_ZONES);
});
after(async () => {
  await server.close();
});

test('login failure surfaces the API message', async () => {
  const client = new NetcupClient({ ...creds, apiPassword: 'wrong' }, { endpoint: server.url });
  await assert.rejects(client.login(), (err: unknown) => {
    assert.ok(err instanceof NetcupApiError);
    assert.equal(err.statuscode, 4011);
    assert.match(err.message, /api key is invalid/);
    return true;
  });
});

test('lists domains after implicit login', async () => {
  const client = new NetcupClient(creds, { endpoint: server.url });
  assert.deepEqual(await client.listDomains(), ['example.com', 'example.net', 'example.org']);
  assert.ok(client.isLoggedIn);
});

test('reads zone and records', async () => {
  const client = new NetcupClient(creds, { endpoint: server.url });
  const zone = await client.getZone('example.com');
  assert.equal(zone.ttl, '3600');
  const records = await client.getRecords('example.com');
  assert.equal(records.length, 6);
  assert.deepEqual(records[0], { id: '1', hostname: '@', type: 'A', priority: '0', destination: '203.0.113.10', deleterecord: false, state: 'yes' });
});

test('an empty zone yields an empty list instead of an error', async () => {
  const client = new NetcupClient(creds, { endpoint: server.url });
  assert.deepEqual(await client.getRecords('example.net'), []);
});

test('create, update and delete a record', async () => {
  const client = new NetcupClient(creds, { endpoint: server.url });
  const afterCreate = await client.createRecord('example.org', { hostname: 'app', type: 'A', priority: '', destination: '203.0.113.99' });
  const created = afterCreate.find((r) => r.hostname === 'app');
  assert.ok(created);
  assert.notEqual(created.id, '');
  const sent = server.state.requests.at(-1)!;
  const sentRecord = (sent.param.dnsrecordset as { dnsrecords: Record<string, unknown>[] }).dnsrecords[0];
  assert.equal(sentRecord.id, undefined, 'new records must not carry an id');
  assert.equal(sentRecord.priority, '0', 'empty priority is sent as 0');

  const afterUpdate = await client.saveRecord('example.org', { ...created, destination: '203.0.113.100' });
  assert.equal(afterUpdate.find((r) => r.id === created.id)?.destination, '203.0.113.100');

  const afterDelete = await client.deleteRecord('example.org', created);
  assert.equal(afterDelete.find((r) => r.id === created.id), undefined);
});

test('re-authenticates once when the session expired', async () => {
  const client = new NetcupClient(creds, { endpoint: server.url });
  await client.listDomains();
  server.state.expireNext = true;
  const before = server.state.requests.length;
  const domains = await client.listDomains();
  assert.equal(domains.length, 3);
  const actions = server.state.requests.slice(before).map((r) => r.action);
  assert.deepEqual(actions, ['listallDomains', 'login', 'listallDomains']);
});

test('logout clears the session and never throws', async () => {
  const client = new NetcupClient(creds, { endpoint: server.url });
  await client.listDomains();
  await client.logout();
  assert.equal(client.isLoggedIn, false);
  await client.logout();
});

test('listallDomains on a non-reseller account is recognisable', async () => {
  const client = new NetcupClient(creds, { endpoint: server.url });
  server.state.reseller = false;
  try {
    await assert.rejects(client.listDomains(), (err: unknown) => isResellerOnlyError(err));
  } finally {
    server.state.reseller = true;
  }
});
