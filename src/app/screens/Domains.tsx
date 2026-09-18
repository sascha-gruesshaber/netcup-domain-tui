import React, { useState } from 'react';
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

  useInput((input, key) => {
    if (adding) {
      if (key.escape) {
        setAdding(false);
        setDraft('');
      }
      return;
    }
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
      help={adding ? 'Enter add · Esc cancel' : '↑↓ select · Enter open · a add domain manually · x remove manual domain · r refresh · q quit'}
    >
      <Box flexDirection="column" marginTop={1}>
        {all.length === 0 && !adding ? (
          <Text dimColor>No domains found. Press "a" to add a domain name by hand.</Text>
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
