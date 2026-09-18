import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface Props {
  label: string;
  value: string;
  active: boolean;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  mask?: string;
  placeholder?: string;
  hint?: string;
}

export function Field({ label, value, active, onChange, onSubmit, mask, placeholder, hint }: Props) {
  return (
    <Box>
      <Box width={14}>
        <Text color={active ? 'cyan' : undefined} bold={active}>
          {active ? '▶ ' : '  '}
          {label}
        </Text>
      </Box>
      <Box>
        {active ? (
          <TextInput value={value} onChange={onChange} onSubmit={onSubmit} mask={mask} placeholder={placeholder} />
        ) : (
          <Text>{mask && value ? mask.repeat(value.length) : value || <Text dimColor>{placeholder ?? ''}</Text>}</Text>
        )}
      </Box>
      {hint ? (
        <Box marginLeft={2}>
          <Text dimColor>{hint}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
