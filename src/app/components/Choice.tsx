import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  label: string;
  options: readonly string[];
  value: string;
  active: boolean;
}

/** Horizontal picker; the parent handles ←/→ to change the value. */
export function Choice({ label, options, value, active }: Props) {
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
          <Text>
            {options.map((opt, i) => (
              <Text key={opt}>
                {i > 0 ? ' ' : ''}
                {opt === value ? (
                  <Text inverse color="cyan">
                    {' '}
                    {opt}{' '}
                  </Text>
                ) : (
                  <Text dimColor>{opt}</Text>
                )}
              </Text>
            ))}
          </Text>
        ) : (
          <Text>{value}</Text>
        )}
      </Box>
    </Box>
  );
}
