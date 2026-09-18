import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Credentials } from './netcup/types.js';

export interface AppConfig {
  credentials?: Credentials;
  /** Domains added by hand, e.g. when listallDomains is not permitted for the API key. */
  extraDomains: string[];
}

export const ENV_VARS = {
  customerNumber: 'NETCUP_CUSTOMER_NUMBER',
  apiKey: 'NETCUP_API_KEY',
  apiPassword: 'NETCUP_API_PASSWORD',
} as const;

export function configDir(env: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  if (env.NETCUP_DNS_CONFIG_DIR) return env.NETCUP_DNS_CONFIG_DIR;
  if (platform === 'win32') {
    return path.join(env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'netcup-dns');
  }
  return path.join(env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'netcup-dns');
}

export function configPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(configDir(env), 'config.json');
}

export function credentialsFromEnv(env: NodeJS.ProcessEnv = process.env): Credentials | undefined {
  const customerNumber = env[ENV_VARS.customerNumber];
  const apiKey = env[ENV_VARS.apiKey];
  const apiPassword = env[ENV_VARS.apiPassword];
  if (customerNumber && apiKey && apiPassword) {
    return { customerNumber, apiKey, apiPassword };
  }
  return undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const file = configPath(env);
  let stored: Partial<AppConfig> = {};
  if (fs.existsSync(file)) {
    try {
      stored = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<AppConfig>;
    } catch {
      stored = {};
    }
  }
  const credentials = credentialsFromEnv(env) ?? stored.credentials;
  return {
    credentials: credentials && isComplete(credentials) ? credentials : undefined,
    extraDomains: Array.isArray(stored.extraDomains) ? stored.extraDomains.map(String) : [],
  };
}

export function saveConfig(config: AppConfig, env: NodeJS.ProcessEnv = process.env): string {
  const file = configPath(env);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Windows does not support POSIX modes; ignore.
  }
  return file;
}

function isComplete(c: Partial<Credentials>): c is Credentials {
  return Boolean(c.customerNumber && c.apiKey && c.apiPassword);
}
