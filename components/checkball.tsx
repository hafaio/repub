import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import Checkbox, { type CheckboxProps } from "@mui/material/Checkbox";
import { styled } from "@mui/material/styles";
import type { ReactElement } from "react";

type CheckballProps = Omit<CheckboxProps, "icon" | "checkedIcon">;

function MuiCheckball(props: CheckballProps): ReactElement {
  return (
    <Checkbox
      icon={<RadioButtonUncheckedIcon />}
      checkedIcon={<CheckCircleOutlineIcon />}
      {...props}
    />
  );
}

const Checkball = styled(MuiCheckball)<CheckballProps>(() => ({
  marginLeft: "15px",
  marginRight: "15px",
  alignSelf: "flex-start",
}));

export default Checkball;
