import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { ReactElement, useCallback } from "react";
import Right from "./right";

export default function ButtonSelection<T extends string>({
  value,
  onChange,
  selections,
  title,
  caption,
}: {
  value: T | undefined;
  onChange: (val: T) => void;
  selections: { val: T; icon: ReactElement }[];
  title: string;
  caption: string;
}): ReactElement {
  const change = useCallback(
    (_: unknown, newVal: string | null) => {
      if (newVal !== null) {
        onChange(newVal as T);
      }
    },
    [onChange],
  );

  const buttons = selections.map(({ val, icon }) => (
    <ToggleButton key={val} value={val} aria-label={val}>
      {icon}
    </ToggleButton>
  ));

  return (
    <Right>
      <Stack spacing={1}>
        <Box>
          <Typography>{title}</Typography>
          <Typography variant="caption">{caption}</Typography>
        </Box>
        <ToggleButtonGroup
          orientation="horizontal"
          value={value ?? ""}
          disabled={value === undefined}
          exclusive
          onChange={change}
        >
          {buttons}
        </ToggleButtonGroup>
      </Stack>
    </Right>
  );
}
