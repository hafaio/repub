import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ReactElement } from "react";
import Checkball from "./checkball";
import FormControlLabel from "./form-control-label";

export default function CheckboxSelection({
  value,
  onToggle,
  title,
  caption,
}: {
  value: boolean | undefined;
  onToggle: () => void;
  title: string;
  caption: string;
}): ReactElement {
  const checkbox = (
    <Checkball
      checked={!!value}
      disabled={value === undefined}
      onClick={onToggle}
    />
  );
  const label = (
    <Box>
      <Typography>{title}</Typography>
      <Typography variant="caption">{caption}</Typography>
    </Box>
  );
  return <FormControlLabel control={checkbox} label={label} />;
}
