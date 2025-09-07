import Box from "@mui/material/Box";
import Stack, { type StackProps } from "@mui/material/Stack";
import type { ReactElement } from "react";

interface Props extends StackProps {
  label: ReactElement;
}

export default function LeftRight({
  children,
  label,
  ...rest
}: Props): ReactElement {
  return (
    <Stack direction="row" {...rest}>
      <Stack sx={{ width: "72px", flexShrink: "0", alignItems: "center" }}>
        <Box>{children}</Box>
      </Stack>
      <Box>{label}</Box>
    </Stack>
  );
}
