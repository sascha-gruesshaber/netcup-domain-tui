import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Frame } from '../components/Frame.js';
import { Field } from '../components/Field.js';
import type { Credentials } from '../../netcup/types.js';
import { ENV_VARS } from '../../config.js';

interface Props {
  initial?: Partial<Credentials>;
  configFile: string;
  error?: string | null;
  busy?: boolean;
  onSubmit: (creds: Credentials, save: boolean) => void;
  onQuit: () => void;
}

const FIELDS = ['customerNumber', 'apiKey', 'apiPassword', 'save'] as const;

export function Setup({ initial, configFile, error, busy, onSubmit, onQuit }: Props) {
  const [values, setValues] = useState<Credentials>({
    customerNumber: initial?.customerNumber ?? '',
    apiKey: initial?.apiKey ?? '',
    apiPassword: initial?.apiPassword ?? '',
  });
  const [save, setSave] = useState(true);
  const [index, setIndex] = useState(0);
  const current = FIELDS[index];

  const submit = () => {
    if (!values.customerNumber || !values.apiKey || !values.apiPassword) return;
    onSubmit(values, save);
  };

  useInput((input, key) => {
    if (busy) return;
    if (key.escape) return onQuit();
    if (key.tab && key.shift) return setIndex((i) => (i + FIELDS.length - 1) % FIELDS.length);
    if (key.tab || key.downArrow) return setIndex((i) => (i + 1) % FIELDS.length);
    if (key.upArrow) return setIndex((i) => (i + FIELDS.length - 1) % FIELDS.length);
    if (current === 'save') {
      if (input === ' ' || key.leftArrow || key.rightArrow) setSave((s) => !s);
      if (key.return) submit();
    }
  });

  const next = () => (index === FIELDS.length - 2 ? submit() : setIndex((i) => i + 1));
  const set = (k: keyof Credentials) => (v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  return (
    <Frame
      title="Login"
      help="Tab/↑↓ move · Enter next/login · Space toggle save · Esc quit"
      status={busy ? { kind: 'busy', text: 'Logging in…' } : error ? { kind: 'error', text: error } : null}
    >
      <Box flexDirection="column" marginTop={1}>
        <Text>Enter the API credentials from the netcup Customer Control Panel (Master data → API).</Text>
        <Text dimColor>
          Alternatively set {ENV_VARS.customerNumber}, {ENV_VARS.apiKey} and {ENV_VARS.apiPassword}.
        </Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Field label="Customer no." value={values.customerNumber} active={current === 'customerNumber'} onChange={set('customerNumber')} onSubmit={next} placeholder="123456" />
        <Field label="API key" value={values.apiKey} active={current === 'apiKey'} onChange={set('apiKey')} onSubmit={next} mask="•" />
        <Field label="API password" value={values.apiPassword} active={current === 'apiPassword'} onChange={set('apiPassword')} onSubmit={next} mask="•" />
        <Box>
          <Box width={14}>
            <Text color={current === 'save' ? 'cyan' : undefined} bold={current === 'save'}>
              {current === 'save' ? '▶ ' : '  '}Save
            </Text>
          </Box>
          <Text>
            [{save ? 'x' : ' '}] store credentials in <Text dimColor>{configFile}</Text>
          </Text>
        </Box>
      </Box>
    </Frame>
  );
}
