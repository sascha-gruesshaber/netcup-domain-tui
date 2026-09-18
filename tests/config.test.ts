import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { configDir, configPath, loadConfig, saveConfig } from '../src/config.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'netcup-dns-'));

test('config dir follows platform conventions', () => {
  assert.equal(configDir({ NETCUP_DNS_CONFIG_DIR: '/x' }, 'darwin'), '/x');
  assert.equal(configDir({ XDG_CONFIG_HOME: '/xdg' }, 'linux'), path.join('/xdg', 'netcup-dns'));
  assert.equal(configDir({ APPDATA: 'C:\\Users\\me\\AppData\\Roaming' }, 'win32'), path.join('C:\\Users\\me\\AppData\\Roaming', 'netcup-dns'));
});

test('environment variables take precedence over the stored file', () => {
  const dir = tmp();
  saveConfig({ credentials: { customerNumber: '1', apiKey: 'a', apiPassword: 'b' }, extraDomains: ['stored.example'] }, { NETCUP_DNS_CONFIG_DIR: dir });
  const cfg = loadConfig({ NETCUP_DNS_CONFIG_DIR: dir, NETCUP_CUSTOMER_NUMBER: '2', NETCUP_API_KEY: 'c', NETCUP_API_PASSWORD: 'd' });
  assert.deepEqual(cfg.credentials, { customerNumber: '2', apiKey: 'c', apiPassword: 'd' });
  assert.deepEqual(cfg.extraDomains, ['stored.example']);
});

test('missing or broken config yields no credentials', () => {
  const dir = tmp();
  assert.equal(loadConfig({ NETCUP_DNS_CONFIG_DIR: dir }).credentials, undefined);
  fs.writeFileSync(configPath({ NETCUP_DNS_CONFIG_DIR: dir }), '{not json');
  assert.equal(loadConfig({ NETCUP_DNS_CONFIG_DIR: dir }).credentials, undefined);
});

test('saved config file is private on POSIX', { skip: process.platform === 'win32' }, () => {
  const dir = tmp();
  const file = saveConfig({ credentials: { customerNumber: '1', apiKey: 'a', apiPassword: 'b' }, extraDomains: [] }, { NETCUP_DNS_CONFIG_DIR: dir });
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});
