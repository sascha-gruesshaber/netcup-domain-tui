export const RECORD_TYPES = [
  'A',
  'AAAA',
  'CNAME',
  'MX',
  'TXT',
  'NS',
  'SRV',
  'CAA',
  'TLSA',
  'SSHFP',
  'OPENPGPKEY',
  'SMIMEA',
] as const;

export type RecordType = (typeof RECORD_TYPES)[number];

/** A DNS record as returned by / sent to the netcup API. */
export interface DnsRecord {
  /** Empty string for records that do not exist yet. */
  id: string;
  hostname: string;
  type: string;
  priority: string;
  destination: string;
  deleterecord: boolean;
  state: string;
}

export interface DnsZone {
  name: string;
  ttl: string;
  serial: string;
  refresh: string;
  retry: string;
  expire: string;
  dnssecstatus: boolean;
}

export interface Credentials {
  customerNumber: string;
  apiKey: string;
  apiPassword: string;
}

export interface ApiResponse<T = unknown> {
  serverrequestid: string;
  clientrequestid?: string;
  action: string;
  status: 'error' | 'started' | 'pending' | 'warning' | 'success';
  statuscode: number;
  shortmessage: string;
  longmessage?: string;
  responsedata?: T;
}

export class NetcupApiError extends Error {
  constructor(
    public readonly action: string,
    public readonly statuscode: number,
    public readonly shortmessage: string,
    public readonly longmessage: string | undefined,
  ) {
    super(`${action}: ${shortmessage}${longmessage ? ` – ${longmessage}` : ''} (code ${statuscode})`);
    this.name = 'NetcupApiError';
  }
}

/** True for types that use the priority field. */
export function usesPriority(type: string): boolean {
  return type === 'MX' || type === 'SRV';
}
