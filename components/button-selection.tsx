import Box from "@mui/material/Box";
import MuiFormControlLabel, {
  type FormControlLabelProps,
} from "@mui/material/FormControlLabel";
import { styled } from "@mui/material/styles";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
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
  selections: { val: T; icon: ReactElement; label?: string }[];
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

  const groupDisabled = disabled || value === undefined;
  const buttons = selections.map(({ val, icon, label }) => {
    const button = (
      <ToggleButton key={val} value={val} aria-label={label ?? val}>
        {icon}
      </ToggleButton>
    );
    // a disabled button doesn't fire the events Tooltip needs to listen for
    return groupDisabled ? (
      button
    ) : (
      <Tooltip key={val} title={label ?? val}>
        {button}
      </Tooltip>
    );
  });

  const control = (
    <ToggleButtonGroup
      orientation="horizontal"
      value={value ?? ""}
      disabled={groupDisabled}
      exclusive
      onChange={change}
    >
      {buttons}
    </ToggleButtonGroup>
  );
  const current = selections.find((sel) => sel.val === value)?.label ?? value;
  const label = (
    <Box>
      <Typography>
        {title}
        {current ? (
          <Typography
            component="span"
            variant="caption"
            sx={{ ml: 1, color: "text.secondary" }}
          >
            {current}
          </Typography>
        ) : null}
      </Typography>
      <Typography variant="caption">{caption}</Typography>
    </Box>
  );
  return (
    <Right>
      <FormControlLabel control={control} label={label} labelPlacement="top" />
    </Right>
  );
}
