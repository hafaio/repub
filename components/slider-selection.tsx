import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import { type ReactElement, useCallback } from "react";
import Right from "./right";

export default function SliderSelection({
  value,
  onChange,
  options,
  title,
  caption,
}: {
  value: number | undefined;
  onChange: (val: number) => void;
  options: { value: number; label: string }[];
  title: string;
  caption: string;
}): ReactElement {
  const change = useCallback(
    (_: unknown, val: number | number[]) => {
      onChange(val as number);
    },
    [onChange],
  );
  const min = Math.min(...options.map(({ value }) => value));
  const max = Math.max(...options.map(({ value }) => value));
  return (
    <Right>
      <Typography>{title}</Typography>
      <Typography variant="caption">{caption}</Typography>
      <Slider
        value={value ?? min}
        onChange={change}
        marks={options}
        min={min}
        max={max}
        step={null}
        disabled={value === undefined}
      />
    </Right>
  );
}
