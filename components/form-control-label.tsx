import MuiFormControlLabel, {
  type FormControlLabelProps,
} from "@mui/material/FormControlLabel";
import { styled } from "@mui/material/styles";

const FormControlLabel = styled(MuiFormControlLabel)<FormControlLabelProps>(
  () => ({
    // MUI has negative margins that make the layout inconsistent
    marginLeft: "0",
    width: "100%",
  }),
);

export default FormControlLabel;
