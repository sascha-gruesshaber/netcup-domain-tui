import http from 'node:http';
import type { AddressInfo } from 'node:net';

/** In-memory stand-in for the netcup CCP JSON endpoint. */
export interface MockState {
  domains: Record<string, Record<string, unknown>[]>;
  sessions: Set<string>;
  requests: { action: string; param: Record<string, unknown> }[];
  /** When set, the next authenticated call fails with a session error once. */
  expireNext: boolean;
  /** Real (non-reseller) accounts get error 4020 from listallDomains. */
  reseller: boolean;
  nextId: number;
}

export interface MockServer {
  url: string;
  state: MockState;
  close: () => Promise<void>;
}

export async function startMockServer(seed: Record<string, Record<string, unknown>[]> = {}): Promise<MockServer> {
  const state: MockState = { domains: structuredClone(seed), sessions: new Set(), requests: [], expireNext: false, reseller: true, nextId: 1000 };

  const reply = (action: string, status: 'success' | 'error', code: number, short: string, data?: unknown, long?: string) => ({
    serverrequestid: 'srv',
    action,
    status,
    statuscode: code,
    shortmessage: short,
    longmessage: long,
    responsedata: data,
  });

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const { action, param } = JSON.parse(body) as { action: string; param: Record<string, unknown> };
      state.requests.push({ action, param });
      const send = (payload: unknown) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(payload));
      };
      if (action === 'login') {
        if (param.apipassword !== 'secret') return send(reply(action, 'error', 4011, 'Validation Error.', undefined, 'The api key is invalid.'));
        const sid = `sess-${state.sessions.size + 1}`;
        state.sessions.add(sid);
        return send(reply(action, 'success', 2000, 'Login successful', { apisessionid: sid }));
      }
      if (!state.sessions.has(String(param.apisessionid)) || state.expireNext) {
        state.expireNext = false;
        state.sessions.delete(String(param.apisessionid));
        return send(reply(action, 'error', 4001, 'Validation Error.', undefined, 'The session id is not in a valid format.'));
      }
      const domain = String(param.domainname ?? '');
      switch (action) {
        case 'logout':
          state.sessions.delete(String(param.apisessionid));
          return send(reply(action, 'success', 2000, 'Logout successful'));
        case 'listallDomains':
          if (!state.reseller) return send(reply(action, 'error', 4020, 'Function not available', undefined, 'This function is available for resellers.'));
          return send(reply(action, 'success', 2000, 'ok', Object.keys(state.domains).map((domainname) => ({ domainname }))));
        case 'infoDnsZone':
          if (!(domain in state.domains)) return send(reply(action, 'error', 4013, 'Validation Error.', undefined, 'Domain not found.'));
          return send(reply(action, 'success', 2000, 'ok', { name: domain, ttl: '3600', serial: '2026091801', refresh: '28800', retry: '7200', expire: '1209600', dnssecstatus: false }));
        case 'infoDnsRecords': {
          const records = state.domains[domain];
          if (!records) return send(reply(action, 'error', 4013, 'Validation Error.', undefined, 'Domain not found.'));
          if (records.length === 0) return send(reply(action, 'error', 5029, 'Validation Error.', undefined, 'No DNS records found for this domain.'));
          return send(reply(action, 'success', 2000, 'ok', { dnsrecords: records }));
        }
        case 'updateDnsRecords': {
          const records = state.domains[domain];
          if (!records) return send(reply(action, 'error', 4013, 'Validation Error.', undefined, 'Domain not found.'));
          const set = (param.dnsrecordset as { dnsrecords: Record<string, unknown>[] }).dnsrecords;
          for (const r of set) {
            if (r.deleterecord === true) {
              const i = records.findIndex((x) => x.id === r.id);
              if (i >= 0) records.splice(i, 1);
            } else if (r.id === undefined || r.id === '') {
              records.push({ ...r, id: String(state.nextId++), deleterecord: false, state: 'yes' });
            } else {
              const i = records.findIndex((x) => x.id === r.id);
              if (i >= 0) records[i] = { ...records[i], ...r, deleterecord: false, state: 'yes' };
            }
          }
          return send(reply(action, 'success', 2000, 'ok', { dnsrecords: records }));
        }
        default:
          return send(reply(action, 'error', 4000, 'Unknown action'));
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/endpoint.php?JSON`,
    state,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

export const SAMPLE_ZONES: Record<string, Record<string, unknown>[]> = {
  'example.com': [
    { id: '1', hostname: '@', type: 'A', priority: '0', destination: '203.0.113.10', deleterecord: false, state: 'yes' },
    { id: '2', hostname: '@', type: 'AAAA', priority: '0', destination: '2001:db8::10', deleterecord: false, state: 'yes' },
    { id: '3', hostname: 'www', type: 'CNAME', priority: '0', destination: 'example.com', deleterecord: false, state: 'yes' },
    { id: '4', hostname: '@', type: 'MX', priority: '10', destination: 'mail.example.com', deleterecord: false, state: 'yes' },
    { id: '5', hostname: '@', type: 'TXT', priority: '0', destination: 'v=spf1 mx -all', deleterecord: false, state: 'yes' },
    { id: '6', hostname: 'home', type: 'A', priority: '0', destination: '198.51.100.42', deleterecord: false, state: 'yes' },
  ],
  'example.org': [
    { id: '7', hostname: '@', type: 'A', priority: '0', destination: '203.0.113.20', deleterecord: false, state: 'yes' },
  ],
  'example.net': [],
};
