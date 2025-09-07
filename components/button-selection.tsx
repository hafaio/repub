import Box from "@mui/material/Box";
import MuiFormControlLabel, {
  type FormControlLabelProps,
} from "@mui/material/FormControlLabel";
import { styled } from "@mui/material/styles";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { type ReactElement, useCallback } from "react";
import Right from "./right";

const FormControlLabel = styled(MuiFormControlLabel)<FormControlLabelProps>(
  () => ({
    // MUI has negative margins that make the layout inconsistent
    marginLeft: "0",
    marginRight: "0",
    alignItems: "start",
    gap: "0.5rem",
  }),
);

export default function ButtonSelection<T extends string>({
  value,
  onChange,
  selections,
  title,
  caption,
  disabled = false,
}: {
  value: T | undefined;
  onChange: (val: T) => void;
  selections: { val: T; icon: ReactElement }[];
  title: string;
  caption: string;
  disabled?: boolean;
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

  const control = (
    <ToggleButtonGroup
      orientation="horizontal"
      value={value ?? ""}
      disabled={disabled || value === undefined}
      exclusive
      onChange={change}
    >
      {buttons}
    </ToggleButtonGroup>
  );
  const label = (
    <Box>
      <Typography>{title}</Typography>
      <Typography variant="caption">{caption}</Typography>
    </Box>
  );
  return (
    <Right>
      <FormControlLabel control={control} label={label} labelPlacement="top" />
    </Right>
  );
}
