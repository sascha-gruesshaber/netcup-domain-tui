import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Frame } from '../components/Frame.js';
import { Field } from '../components/Field.js';
import { Choice } from '../components/Choice.js';
import { RECORD_TYPES, usesPriority, type DnsRecord } from '../../netcup/types.js';

interface Props {
  domain: string;
  record: DnsRecord;
  busy: boolean;
  error: string | null;
  onSave: (record: DnsRecord) => void;
  onCancel: () => void;
}

export function validateRecord(r: DnsRecord): string | null {
  if (!r.hostname.trim()) return 'Hostname is required (use @ for the zone root).';
  if (!r.destination.trim()) return 'Destination is required.';
  if (usesPriority(r.type) && !/^\d+$/.test(r.priority.trim())) return `${r.type} records need a numeric priority.`;
  if (r.type === 'A' && !/^\d{1,3}(\.\d{1,3}){3}$/.test(r.destination.trim())) return 'A records need an IPv4 address.';
  if (r.type === 'AAAA' && !/^[0-9a-f:]+$/i.test(r.destination.trim())) return 'AAAA records need an IPv6 address.';
  return null;
}

export function RecordForm({ domain, record, busy, error, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<DnsRecord>({ ...record, type: record.type || 'A' });
  const [index, setIndex] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const isNew = record.id === '';
  const fields = ['hostname', 'type', ...(usesPriority(draft.type) ? ['priority'] : []), 'destination'] as const;
  const current = fields[Math.min(index, fields.length - 1)];

  const submit = () => {
    const cleaned: DnsRecord = {
      ...draft,
      hostname: draft.hostname.trim(),
      destination: draft.destination.trim(),
      priority: usesPriority(draft.type) ? draft.priority.trim() : '0',
    };
    const problem = validateRecord(cleaned);
    setLocalError(problem);
    if (!problem) onSave(cleaned);
  };

  useInput((input, key) => {
    if (busy) return;
    if (key.escape) return onCancel();
    if (key.tab && key.shift) return setIndex((i) => (i + fields.length - 1) % fields.length);
    if (key.tab || key.downArrow) return setIndex((i) => (i + 1) % fields.length);
    if (key.upArrow) return setIndex((i) => (i + fields.length - 1) % fields.length);
    if (current === 'type') {
      const pos = RECORD_TYPES.indexOf(draft.type as (typeof RECORD_TYPES)[number]);
      if (key.leftArrow) setDraft({ ...draft, type: RECORD_TYPES[(pos + RECORD_TYPES.length - 1) % RECORD_TYPES.length] });
      if (key.rightArrow || input === ' ') setDraft({ ...draft, type: RECORD_TYPES[(pos + 1) % RECORD_TYPES.length] });
      if (key.return) setIndex((i) => i + 1);
    }
  });

  const next = () => (current === 'destination' ? submit() : setIndex((i) => i + 1));
  const set = (k: keyof DnsRecord) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const status = busy
    ? { kind: 'busy' as const, text: 'Saving…' }
    : localError ?? error
      ? { kind: 'error' as const, text: (localError ?? error) as string }
      : null;

  return (
    <Frame
      title={isNew ? 'New record' : 'Edit record'}
      subtitle={domain}
      status={status}
      help="Tab/↑↓ move · ←/→ change type · Enter next/save · Esc cancel"
    >
      <Box flexDirection="column" marginTop={1}>
        <Field label="Hostname" value={draft.hostname} active={current === 'hostname'} onChange={set('hostname')} onSubmit={next} placeholder="@" hint={`@ = ${domain}, "www" = www.${domain}`} />
        <Choice label="Type" options={RECORD_TYPES} value={draft.type} active={current === 'type'} />
        {usesPriority(draft.type) ? (
          <Field label="Priority" value={draft.priority} active={current === 'priority'} onChange={set('priority')} onSubmit={next} placeholder="10" />
        ) : null}
        <Field label="Destination" value={draft.destination} active={current === 'destination'} onChange={set('destination')} onSubmit={next} placeholder={placeholderFor(draft.type)} />
        {!isNew ? (
          <Box marginTop={1}>
            <Text dimColor>Record id {record.id}</Text>
          </Box>
        ) : null}
      </Box>
    </Frame>
  );
}

function placeholderFor(type: string): string {
  switch (type) {
    case 'A':
      return '203.0.113.10';
    case 'AAAA':
      return '2001:db8::1';
    case 'CNAME':
    case 'NS':
      return 'target.example.com';
    case 'MX':
      return 'mail.example.com';
    case 'TXT':
      return 'v=spf1 -all';
    case 'SRV':
      return '10 5060 sip.example.com';
    case 'CAA':
      return '0 issue "letsencrypt.org"';
    default:
      return '';
  }
}
