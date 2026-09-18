import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from 'ink';
import { NetcupClient, isResellerOnlyError } from '../netcup/client.js';
import type { Credentials, DnsRecord, DnsZone } from '../netcup/types.js';
import { type AppConfig, saveConfig } from '../config.js';
import { Setup } from './screens/Setup.js';
import { Domains } from './screens/Domains.js';
import { Records } from './screens/Records.js';
import { RecordForm } from './screens/RecordForm.js';

type Status = { kind: 'info' | 'error' | 'busy'; text: string } | null;

type Screen =
  | { name: 'setup' }
  | { name: 'domains' }
  | { name: 'records'; domain: string }
  | { name: 'form'; domain: string; record: DnsRecord };

interface Props {
  config: AppConfig;
  configFile: string;
  /** Factory so tests can inject a client that talks to a mock server. */
  createClient: (creds: Credentials) => NetcupClient;
  persist?: (config: AppConfig) => void;
}

const EMPTY_RECORD: DnsRecord = { id: '', hostname: '', type: 'A', priority: '0', destination: '', deleterecord: false, state: '' };

export function App({ config, configFile, createClient, persist = saveConfig }: Props) {
  const { exit } = useApp();
  const clientRef = useRef<NetcupClient | null>(null);
  const [cfg, setCfg] = useState<AppConfig>(config);
  const [screen, setScreen] = useState<Screen>(config.credentials ? { name: 'domains' } : { name: 'setup' });
  const [status, setStatus] = useState<Status>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  const [zone, setZone] = useState<DnsZone | null>(null);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const fail = (err: unknown) => setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) });

  const quit = useCallback(async () => {
    await clientRef.current?.logout();
    exit();
  }, [exit]);

  const loadDomains = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    setStatus({ kind: 'busy', text: 'Loading domains…' });
    try {
      const list = await client.listDomains();
      setDomains(list);
      setStatus(list.length === 0 ? { kind: 'info', text: 'Logged in. The API did not return any domains; add one with "a".' } : { kind: 'info', text: `Loaded ${list.length} domain(s).` });
    } catch (err) {
      setDomains([]);
      if (isResellerOnlyError(err)) {
        setStatus({ kind: 'info', text: 'Logged in. netcup lists domains via API only for reseller accounts, so add yours with "a" (they are remembered).' });
      } else {
        setStatus({ kind: 'error', text: `Could not list domains (${err instanceof Error ? err.message : err}). Add domains manually with "a".` });
      }
    }
  }, []);

  const loadRecords = useCallback(async (domain: string, note?: string) => {
    const client = clientRef.current;
    if (!client) return;
    setStatus({ kind: 'busy', text: `Loading ${domain}…` });
    try {
      const [z, r] = await Promise.all([client.getZone(domain), client.getRecords(domain)]);
      setZone(z);
      setRecords(r);
      setStatus({ kind: 'info', text: note ?? `${r.length} record(s).` });
    } catch (err) {
      fail(err);
    }
  }, []);

  // Connect on start when credentials are already known.
  useEffect(() => {
    if (config.credentials && !clientRef.current) {
      clientRef.current = createClient(config.credentials);
      void loadDomains();
    }
  }, [config.credentials, createClient, loadDomains]);

  const handleLogin = async (creds: Credentials, save: boolean) => {
    setSetupBusy(true);
    setSetupError(null);
    const client = createClient(creds);
    try {
      await client.login();
    } catch (err) {
      setSetupBusy(false);
      setSetupError(err instanceof Error ? err.message : String(err));
      return;
    }
    clientRef.current = client;
    const next = { ...cfg, credentials: creds };
    setCfg(next);
    if (save) {
      try {
        persist(next);
      } catch (err) {
        fail(err);
      }
    }
    setSetupBusy(false);
    setScreen({ name: 'domains' });
    void loadDomains();
  };

  const updateExtraDomains = (extraDomains: string[]) => {
    const next = { ...cfg, extraDomains };
    setCfg(next);
    try {
      persist(next);
    } catch (err) {
      fail(err);
    }
  };

  const addDomain = async (domain: string) => {
    const client = clientRef.current;
    if (!client) return;
    if (cfg.extraDomains.includes(domain) || domains.includes(domain)) {
      setStatus({ kind: 'info', text: `${domain} is already in the list.` });
      return;
    }
    setStatus({ kind: 'busy', text: `Checking ${domain}…` });
    try {
      await client.getZone(domain);
    } catch (err) {
      setStatus({ kind: 'error', text: `${domain}: ${err instanceof Error ? err.message : err}` });
      return;
    }
    updateExtraDomains([...cfg.extraDomains, domain].sort());
    setStatus({ kind: 'info', text: `Added ${domain}.` });
  };

  const openDomain = (domain: string) => {
    setZone(null);
    setRecords([]);
    setScreen({ name: 'records', domain });
    void loadRecords(domain);
  };

  const submitRecord = async (domain: string, record: DnsRecord) => {
    const client = clientRef.current;
    if (!client) return;
    setStatus({ kind: 'busy', text: 'Saving…' });
    setFormError(null);
    try {
      await client.saveRecord(domain, record);
      setScreen({ name: 'records', domain });
      await loadRecords(domain, `Saved ${record.hostname} ${record.type} → ${record.destination}`);
    } catch (err) {
      setStatus(null);
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteRecord = async (domain: string, record: DnsRecord) => {
    const client = clientRef.current;
    if (!client) return;
    setStatus({ kind: 'busy', text: 'Deleting…' });
    try {
      await client.deleteRecord(domain, record);
      await loadRecords(domain, `Deleted ${record.hostname} ${record.type} ${record.destination}`);
    } catch (err) {
      fail(err);
    }
  };

  switch (screen.name) {
    case 'setup':
      return (
        <Setup
          initial={cfg.credentials}
          configFile={configFile}
          error={setupError}
          busy={setupBusy}
          onSubmit={(creds, save) => void handleLogin(creds, save)}
          onQuit={() => void quit()}
        />
      );
    case 'domains':
      return (
        <Domains
          domains={domains}
          extraDomains={cfg.extraDomains}
          status={status}
          onOpen={openDomain}
          onAddDomain={(d) => void addDomain(d)}
          onRemoveDomain={(d) => updateExtraDomains(cfg.extraDomains.filter((x) => x !== d))}
          onRefresh={() => void loadDomains()}
          onQuit={() => void quit()}
        />
      );
    case 'records':
      return (
        <Records
          domain={screen.domain}
          zone={zone}
          records={records}
          status={status}
          onNew={() => {
            setFormError(null);
            setScreen({ name: 'form', domain: screen.domain, record: EMPTY_RECORD });
          }}
          onEdit={(record) => {
            setFormError(null);
            setScreen({ name: 'form', domain: screen.domain, record });
          }}
          onCopy={(record) => {
            setFormError(null);
            setScreen({ name: 'form', domain: screen.domain, record: { ...record, id: '', state: '' } });
          }}
          onDelete={(record) => void deleteRecord(screen.domain, record)}
          onRefresh={() => void loadRecords(screen.domain)}
          onBack={() => {
            setStatus(null);
            setScreen({ name: 'domains' });
          }}
          onQuit={() => void quit()}
        />
      );
    case 'form':
      return (
        <RecordForm
          domain={screen.domain}
          record={screen.record}
          busy={status?.kind === 'busy'}
          error={formError}
          onSave={(record) => void submitRecord(screen.domain, record)}
          onCancel={() => {
            setStatus(null);
            setScreen({ name: 'records', domain: screen.domain });
          }}
        />
      );
  }
}
