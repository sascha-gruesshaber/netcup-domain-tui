import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Frame } from '../components/Frame.js';
import { Confirm } from '../components/Confirm.js';
import type { DnsRecord, DnsZone } from '../../netcup/types.js';

interface Props {
  domain: string;
  zone: DnsZone | null;
  records: DnsRecord[];
  status: { kind: 'info' | 'error' | 'busy'; text: string } | null;
  onNew: () => void;
  onEdit: (record: DnsRecord) => void;
  onDelete: (record: DnsRecord) => void;
  onCopy: (record: DnsRecord) => void;
  onRefresh: () => void;
  onBack: () => void;
  onQuit: () => void;
}

const COLS = { host: 24, type: 8, prio: 6 };

export function Records({ domain, zone, records, status, onNew, onEdit, onDelete, onCopy, onRefresh, onBack, onQuit }: Props) {
  const [cursor, setCursor] = useState(0);
  const [filter, setFilter] = useState('');
  const [filtering, setFiltering] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DnsRecord | null>(null);

  const visible = records
    .filter((r) => !filter || `${r.hostname} ${r.type} ${r.destination}`.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => a.hostname.localeCompare(b.hostname) || a.type.localeCompare(b.type) || a.destination.localeCompare(b.destination));
  const selected = visible[Math.min(cursor, Math.max(visible.length - 1, 0))];
  const busy = status?.kind === 'busy';

  useEffect(() => {
    if (cursor > visible.length - 1) setCursor(Math.max(0, visible.length - 1));
  }, [visible.length, cursor]);

  useInput((input, key) => {
    if (confirmDelete || busy) return;
    if (filtering) {
      if (key.escape) {
        setFiltering(false);
        setFilter('');
      }
      if (key.return) setFiltering(false);
      return;
    }
    if (input === 'q') return onQuit();
    if (key.escape || input === 'b' || key.backspace) return onBack();
    if (input === 'r') return onRefresh();
    if (input === 'n') return onNew();
    if (input === '/') return setFiltering(true);
    if (key.upArrow || input === 'k') return setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow || input === 'j') return setCursor((c) => Math.min(visible.length - 1, c + 1));
    if (key.pageUp) return setCursor((c) => Math.max(0, c - 10));
    if (key.pageDown) return setCursor((c) => Math.min(visible.length - 1, c + 10));
    if (!selected) return;
    if (key.return || input === 'e') return onEdit(selected);
    if (input === 'c') return onCopy(selected);
    if (input === 'd' || key.delete) return setConfirmDelete(selected);
  });

  const zoneLine = zone
    ? `TTL ${zone.ttl} · serial ${zone.serial} · DNSSEC ${zone.dnssecstatus ? 'on' : 'off'}`
    : 'loading zone…';

  return (
    <Frame
      title={domain}
      subtitle={zoneLine}
      status={status}
      help={
        filtering
          ? 'Type to filter · Enter apply · Esc clear'
          : '↑↓ select · Enter/e edit · n new · c copy · d delete · / filter · r refresh · Esc back · q quit'
      }
    >
      <Box marginTop={1}>
        <Text bold underline>
          {' '}
          {'HOSTNAME'.padEnd(COLS.host)}
          {'TYPE'.padEnd(COLS.type)}
          {'PRIO'.padEnd(COLS.prio)}
          DESTINATION
        </Text>
      </Box>
      {visible.length === 0 ? (
        <Text dimColor> {records.length === 0 ? 'No records in this zone. Press "n" to create one.' : 'No records match the filter.'}</Text>
      ) : null}
      {visible.map((r, i) => {
        const active = i === cursor && !filtering;
        return (
          <Text key={r.id || `${r.hostname}-${r.type}-${r.destination}`} inverse={active} color={active ? 'cyan' : undefined}>
            {' '}
            {clip(r.hostname, COLS.host - 1).padEnd(COLS.host)}
            <Text color={active ? undefined : typeColor(r.type)}>{r.type.padEnd(COLS.type)}</Text>
            {(r.priority && r.priority !== '0' ? r.priority : '').padEnd(COLS.prio)}
            {r.destination}
          </Text>
        );
      })}
      {filtering || filter ? (
        <Box marginTop={1}>
          <Text color="cyan">Filter: </Text>
          {filtering ? <TextInput value={filter} onChange={setFilter} /> : <Text>{filter}</Text>}
        </Box>
      ) : null}
      {confirmDelete ? (
        <Confirm
          question={`Delete this record from ${domain}?`}
          detail={`${confirmDelete.hostname}  ${confirmDelete.type}  ${confirmDelete.destination}`}
          onConfirm={() => {
            const r = confirmDelete;
            setConfirmDelete(null);
            onDelete(r);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
    </Frame>
  );
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function typeColor(type: string): string | undefined {
  switch (type) {
    case 'A':
      return 'green';
    case 'AAAA':
      return 'greenBright';
    case 'CNAME':
      return 'magenta';
    case 'MX':
      return 'yellow';
    case 'TXT':
      return 'blue';
    default:
      return undefined;
  }
}
