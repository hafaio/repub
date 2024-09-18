import Box from "@mui/material/Box";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ReactElement, useCallback } from "react";
import FormControlLabel from "./form-control-label";
import Radio from "./radio";

export default function RadioSelection<T extends string>({
  value,
  onChange,
  selections,
}: {
  value: T | undefined;
  onChange: (opt: T) => void;
  selections: { val: T; title: string; caption: string; disabled?: boolean }[];
}): ReactElement {
  const change = useCallback(
    (_: unknown, newValue: string) => {
      onChange(newValue as T);
    },
    [onChange],
  );

  const choices = selections.map(
    ({ val, title, caption, disabled = false }) => {
      return (
        <FormControlLabel
          key={val}
          value={val}
          control={<Radio />}
          label={
            <Box>
              <Typography>{title}</Typography>
              <Typography variant="caption">{caption}</Typography>
            </Box>
          }
          disabled={disabled || value === undefined}
          checked={value === val}
        />
      );
    },
  );

  return (
    <RadioGroup value={value ?? ""} onChange={change}>
      <Stack spacing={1}>{choices}</Stack>
    </RadioGroup>
  );
}
