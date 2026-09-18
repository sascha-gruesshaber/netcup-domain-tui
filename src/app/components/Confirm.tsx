import React from 'react';
import { Box, Text, useInput } from 'ink';

interface Props {
  question: string;
  detail?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Confirm({ question, detail, onConfirm, onCancel }: Props) {
  useInput((input, key) => {
    if (input === 'y' || input === 'Y' || key.return) onConfirm();
    else if (input === 'n' || input === 'N' || key.escape) onCancel();
  });
  return (
    <Box borderStyle="double" borderColor="red" paddingX={2} paddingY={0} flexDirection="column" marginTop={1}>
      <Text bold color="red">
        {question}
      </Text>
      {detail ? <Text>{detail}</Text> : null}
      <Text dimColor>y / Enter = yes · n / Esc = no</Text>
    </Box>
  );
}
