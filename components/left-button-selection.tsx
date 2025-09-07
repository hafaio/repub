import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { type ReactElement, useCallback } from "react";
import LeftRight from "./left-right";

export default function LeftButtonSelection<T extends string>({
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
  const label = (
    <Box>
      <Typography>{title}</Typography>
      <Typography variant="caption">{caption}</Typography>
    </Box>
  );

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
    <LeftRight label={label}>
      <ToggleButtonGroup
        orientation="vertical"
        value={value ?? ""}
        disabled={value === undefined}
        exclusive
        onChange={change}
      >
        {buttons}
      </ToggleButtonGroup>
    </LeftRight>
  );
}
