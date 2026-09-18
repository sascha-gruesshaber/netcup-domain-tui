import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Frame } from '../components/Frame.js';

interface Props {
  domains: string[];
  extraDomains: string[];
  status: { kind: 'info' | 'error' | 'busy'; text: string } | null;
  onOpen: (domain: string) => void;
  onAddDomain: (domain: string) => void;
  onRemoveDomain: (domain: string) => void;
  onRefresh: () => void;
  onQuit: () => void;
}

export function Domains({ domains, extraDomains, status, onOpen, onAddDomain, onRemoveDomain, onRefresh, onQuit }: Props) {
  const [cursor, setCursor] = useState(0);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const all = [...new Set([...domains, ...extraDomains])].sort();
  const selected = all[Math.min(cursor, Math.max(all.length - 1, 0))];
  const busy = status?.kind === 'busy';

  // Nothing to select yet: jump straight into the add prompt once loading finished.
  useEffect(() => {
    if (all.length === 0 && !busy && status !== null) setAdding(true);
  }, [all.length, busy, status]);

  useInput((input, key) => {
    if (adding) {
      if (key.escape) {
        setAdding(false);
        setDraft('');
        if (all.length === 0) onQuit();
      }
      return;
    }
    if (busy) return;
    if (input === 'q' || key.escape) return onQuit();
    if (input === 'r') return onRefresh();
    if (input === 'a') return setAdding(true);
    if (key.upArrow || input === 'k') return setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow || input === 'j') return setCursor((c) => Math.min(all.length - 1, c + 1));
    if (input === 'x' && selected && extraDomains.includes(selected)) return onRemoveDomain(selected);
    if (key.return && selected) return onOpen(selected);
  });

  const submitDraft = () => {
    const name = draft.trim().toLowerCase().replace(/\.$/, '');
    setAdding(false);
    setDraft('');
    if (name) onAddDomain(name);
  };

  return (
    <Frame
      title="Domains"
      subtitle={`${all.length} domain${all.length === 1 ? '' : 's'}`}
      status={status}
      help={adding ? (all.length === 0 ? 'Enter add · Esc quit' : 'Enter add · Esc cancel') : '↑↓ select · Enter open · a add domain · x remove domain · r refresh · q quit'}
    >
      <Box flexDirection="column" marginTop={1}>
        {all.length === 0 ? (
          <Text dimColor>No domains yet. Type a domain name you manage at netcup, e.g. example.com.</Text>
        ) : null}
        {all.map((d, i) => {
          const active = i === cursor;
          return (
            <Text key={d} color={active ? 'cyan' : undefined} inverse={active}>
              {' '}
              {d.padEnd(40)}
              {extraDomains.includes(d) && !domains.includes(d) ? <Text dimColor> (manual)</Text> : ''}{' '}
            </Text>
          );
        })}
        {adding ? (
          <Box marginTop={1}>
            <Text color="cyan">Domain name: </Text>
            <TextInput value={draft} onChange={setDraft} onSubmit={submitDraft} placeholder="example.com" />
          </Box>
        ) : null}
      </Box>
    </Frame>
  );
}
