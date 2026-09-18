import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  title: string;
  subtitle?: string;
  help: string;
  status?: { kind: 'info' | 'error' | 'busy'; text: string } | null;
  children: React.ReactNode;
}

/** Common chrome: title bar, content area, status line and key help. */
export function Frame({ title, subtitle, help, status, children }: Props) {
  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" paddingX={1} justifyContent="space-between">
        <Text bold color="cyan">
          netcup DNS
        </Text>
        <Text>
          <Text bold>{title}</Text>
          {subtitle ? <Text dimColor> · {subtitle}</Text> : null}
        </Text>
      </Box>
      <Box flexDirection="column" paddingX={1} paddingY={0}>
        {children}
      </Box>
      <Box paddingX={1} marginTop={1} flexDirection="column">
        {status ? (
          <Text color={status.kind === 'error' ? 'red' : status.kind === 'busy' ? 'yellow' : 'green'}>
            {status.kind === 'busy' ? '⏳ ' : status.kind === 'error' ? '✖ ' : '✔ '}
            {status.text}
          </Text>
        ) : null}
        <Text dimColor>{help}</Text>
      </Box>
    </Box>
  );
}
