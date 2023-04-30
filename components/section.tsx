import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MuiAccordion, { AccordionProps } from "@mui/material/Accordion";
import MuiAccordionDetails, {
  AccordionDetailsProps,
} from "@mui/material/AccordionDetails";
import MuiAccordionSummary, {
  AccordionSummaryProps,
} from "@mui/material/AccordionSummary";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";
import { PropsWithChildren, ReactElement } from "react";
import Right from "./right";

const Accordion = styled(MuiAccordion)<AccordionProps>(() => ({
  "&:not(:last-child)": {
    borderBottom: 0,
  },
  "&:before": {
    display: "none",
  },
}));

const AccordionSummary = styled(MuiAccordionSummary)<AccordionSummaryProps>(
  () => ({
    flexDirection: "row-reverse",
    padding: 0,
  })
);

const AccordionDetails = styled(MuiAccordionDetails)<AccordionDetailsProps>(
  () => ({
    paddingLeft: 0,
    paddingRight: 0,
  })
);

export default function Section({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>): ReactElement {
  const sub = subtitle ? (
    <Right>
      <Typography variant="subtitle2">{subtitle}</Typography>
    </Right>
  ) : null;
  return (
    <Accordion elevation={0}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ ml: 2.875, mr: 2.875 }} />}
      >
        <Typography variant="h5">{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          {sub}
          {children}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
