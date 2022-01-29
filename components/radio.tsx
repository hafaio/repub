import MuiRadio, { RadioProps } from "@mui/material/Radio";
import { styled } from "@mui/material/styles";

const Radio = styled(MuiRadio)<RadioProps>(() => ({
  marginLeft: "15px",
  marginRight: "15px",
  alignSelf: "flex-start",
}));

export default Radio;
