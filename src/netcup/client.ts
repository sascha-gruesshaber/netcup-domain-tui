import {
  type ApiResponse,
  type Credentials,
  type DnsRecord,
  type DnsZone,
  NetcupApiError,
} from './types.js';

export const DEFAULT_ENDPOINT = 'https://ccp.netcup.net/run/webservice/servers/endpoint.php?JSON';

export interface ClientOptions {
  endpoint?: string;
  fetch?: typeof fetch;
}

function isSessionError(err: unknown): boolean {
  if (!(err instanceof NetcupApiError)) return false;
  const text = `${err.shortmessage} ${err.longmessage ?? ''}`.toLowerCase();
  return text.includes('session');
}

/** listallDomains is only offered to reseller accounts (statuscode 4020). */
export function isResellerOnlyError(err: unknown): boolean {
  if (!(err instanceof NetcupApiError)) return false;
  return err.statuscode === 4020 || /function not available/i.test(err.shortmessage);
}

function isNoRecordsError(err: unknown): boolean {
  if (!(err instanceof NetcupApiError)) return false;
  const text = `${err.shortmessage} ${err.longmessage ?? ''}`.toLowerCase();
  return /no (dns )?records?/.test(text);
}

function str(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

export function normalizeRecord(raw: Record<string, unknown>): DnsRecord {
  return {
    id: str(raw.id),
    hostname: str(raw.hostname),
    type: str(raw.type),
    priority: str(raw.priority),
    destination: str(raw.destination),
    deleterecord: raw.deleterecord === true || raw.deleterecord === 'true',
    state: str(raw.state),
  };
}

/**
 * Thin client for the netcup CCP DNS API.
 * Logs in lazily and transparently re-authenticates once when the session expired.
 */
export class NetcupClient {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private sessionId: string | null = null;

  constructor(
    private readonly credentials: Credentials,
    options: ClientOptions = {},
  ) {
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  get isLoggedIn(): boolean {
    return this.sessionId !== null;
  }

  private async post<T>(action: string, param: Record<string, unknown>): Promise<ApiResponse<T>> {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, param }),
    });
    if (!response.ok) {
      throw new Error(`netcup API returned HTTP ${response.status} for ${action}`);
    }
    const body = (await response.json()) as ApiResponse<T>;
    if (body.status === 'error') {
      throw new NetcupApiError(action, Number(body.statuscode), body.shortmessage, body.longmessage);
    }
    return body;
  }

  async login(): Promise<void> {
    const res = await this.post<{ apisessionid: string }>('login', {
      customernumber: this.credentials.customerNumber,
      apikey: this.credentials.apiKey,
      apipassword: this.credentials.apiPassword,
    });
    const sid = res.responsedata?.apisessionid;
    if (!sid) throw new Error('login succeeded but no apisessionid was returned');
    this.sessionId = sid;
  }

  async logout(): Promise<void> {
    if (!this.sessionId) return;
    const sid = this.sessionId;
    this.sessionId = null;
    try {
      await this.post('logout', {
        customernumber: this.credentials.customerNumber,
        apikey: this.credentials.apiKey,
        apisessionid: sid,
      });
    } catch {
      // A failed logout is harmless: sessions expire on their own.
    }
  }

  /** Runs an authenticated action, logging in first and retrying once on a session error. */
  private async call<T>(action: string, param: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
    if (!this.sessionId) await this.login();
    const run = () =>
      this.post<T>(action, {
        customernumber: this.credentials.customerNumber,
        apikey: this.credentials.apiKey,
        apisessionid: this.sessionId,
        ...param,
      });
    try {
      return await run();
    } catch (err) {
      if (!isSessionError(err)) throw err;
      this.sessionId = null;
      await this.login();
      return run();
    }
  }

  async listDomains(): Promise<string[]> {
    const res = await this.call<unknown>('listallDomains');
    const data = res.responsedata;
    if (!Array.isArray(data)) return [];
    return data
      .map((entry) =>
        typeof entry === 'string' ? entry : str((entry as Record<string, unknown>).domainname),
      )
      .filter((name) => name.length > 0)
      .sort();
  }

  async getZone(domain: string): Promise<DnsZone> {
    const res = await this.call<Record<string, unknown>>('infoDnsZone', { domainname: domain });
    const d = res.responsedata ?? {};
    return {
      name: str(d.name) || domain,
      ttl: str(d.ttl),
      serial: str(d.serial),
      refresh: str(d.refresh),
      retry: str(d.retry),
      expire: str(d.expire),
      dnssecstatus: d.dnssecstatus === true || d.dnssecstatus === 'true',
    };
  }

  async getRecords(domain: string): Promise<DnsRecord[]> {
    try {
      const res = await this.call<{ dnsrecords?: Record<string, unknown>[] }>('infoDnsRecords', {
        domainname: domain,
      });
      return (res.responsedata?.dnsrecords ?? []).map(normalizeRecord);
    } catch (err) {
      if (isNoRecordsError(err)) return [];
      throw err;
    }
  }

  /**
   * Sends a set of records to netcup. Records without id are created,
   * records with deleterecord=true are removed, all others are updated.
   * Returns the full record set after the change.
   */
  async updateRecords(domain: string, records: DnsRecord[]): Promise<DnsRecord[]> {
    const payload = records.map((r) => ({
      id: r.id === '' ? undefined : r.id,
      hostname: r.hostname,
      type: r.type,
      priority: r.priority === '' ? '0' : r.priority,
      destination: r.destination,
      deleterecord: r.deleterecord,
    }));
    const res = await this.call<{ dnsrecords?: Record<string, unknown>[] }>('updateDnsRecords', {
      domainname: domain,
      dnsrecordset: { dnsrecords: payload },
    });
    return (res.responsedata?.dnsrecords ?? []).map(normalizeRecord);
  }

  async createRecord(domain: string, record: Omit<DnsRecord, 'id' | 'deleterecord' | 'state'>): Promise<DnsRecord[]> {
    return this.updateRecords(domain, [{ ...record, id: '', deleterecord: false, state: '' }]);
  }

  async saveRecord(domain: string, record: DnsRecord): Promise<DnsRecord[]> {
    return this.updateRecords(domain, [{ ...record, deleterecord: false }]);
  }

  async deleteRecord(domain: string, record: DnsRecord): Promise<DnsRecord[]> {
    return this.updateRecords(domain, [{ ...record, deleterecord: true }]);
  }
}
