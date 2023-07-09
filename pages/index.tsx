import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import DensityLargeIcon from "@mui/icons-material/DensityLarge";
import DensityMediumIcon from "@mui/icons-material/DensityMedium";
import DensitySmallIcon from "@mui/icons-material/DensitySmall";
import FormatAlignJustifyIcon from "@mui/icons-material/FormatAlignJustify";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import Alert, { AlertColor } from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import OutlinedInput from "@mui/material/OutlinedInput";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Head from "next/head";
import {
  ChangeEvent,
  ReactElement,
  useCallback,
  useEffect,
  useState,
} from "react";
// NOTE import from cjs here due to the way that nextjs handles internal es6 modules
import { register } from "rmapi-js";
import ButtonSelection from "../components/button-selection";
import CheckboxSelection from "../components/checkbox-selection";
import LeftRight from "../components/left-right";
import RadioSelection from "../components/radio-selection";
import Right from "../components/right";
import Section from "../components/section";
import SliderSelection from "../components/slider-selection";
import StaticImage from "../components/static-image";
import {
  Cover,
  defaultOptions,
  getOptions,
  ImageHandling,
  Options,
  OutputStyle,
  setOptions,
  SetOptions,
  TextAlignment,
} from "../src/options";
import { sleep } from "../src/utils";

const theme = createTheme({
  palette: {
    background: {
      paper: "#fff",
    },
    primary: {
      main: "#000",
    },
  },
  shape: {
    borderRadius: 0,
  },
});

const unknownOpts: Partial<Options> = Object.fromEntries(
  Object.entries(defaultOptions).map(([key]) => [key, undefined]),
);

async function getToken(code: string): Promise<string> {
  // This is for testing in dev mode
  if (window.chrome?.runtime?.id) {
    return await register(code);
  } else {
    await sleep(1000);
    return "fake token";
  }
}

function OutputStylePicker({
  outputStyle,
  setOpts,
}: {
  outputStyle: OutputStyle | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onChange = useCallback(
    (val: OutputStyle) => setOpts({ outputStyle: val }),
    [setOpts],
  );

  return (
    <RadioSelection
      value={outputStyle}
      onChange={onChange}
      selections={[
        {
          val: "download",
          title: "Download article as file",
          caption: `With this selected, the article will be converted into an
          epub file and then downloaded. This doesn't required connecting this
          extension to reMarkable, but doesn't allow tweaking reMarkable
          specific upload settings.`,
        },
        {
          val: "upload",
          title: "Upload article to reMarkable",
          caption: `With this selected, the article will be uploaded to your
          reMarkable cloud. This allows tweaking reMarkable upload settings,
          but requires connecting the extension to your reMarkable account.`,
        },
      ]}
    />
  );
}

function SignIn({
  show,
  setOpts,
  showSnack,
}: {
  show: boolean | undefined;
  setOpts: SetOptions;
  showSnack: (snk: Snack) => void;
}): ReactElement | null {
  const [incCode, setIncCode] = useState("");
  const [registering, setRegistering] = useState(false);

  const changeAuth = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) =>
      void (async () => {
        const val = evt.target.value;
        setIncCode(val);
        if (val.length !== 8) return;
        setRegistering(true);
        try {
          const deviceToken = await getToken(val);
          setOpts({ deviceToken });
          showSnack({
            key: "login",
            severity: "success",
            message: "linked reMarkable account successfully",
          });
        } catch (ex) {
          showSnack({
            key: "login error",
            severity: "error",
            message: "problem trying to link reMarkable account",
          });
        } finally {
          setIncCode("");
          setRegistering(false);
        }
      })(),
    [setIncCode, setRegistering, setOpts],
  );
  const clipboard = useCallback(
    () =>
      void (async () => {
        setRegistering(true);
        try {
          const content = await navigator.clipboard.readText();
          if (content.length !== 8) return;
          setIncCode(content);
          const deviceToken = await getToken(content);
          setOpts({ deviceToken });
          showSnack({
            key: "login",
            severity: "success",
            message: "linked reMarkable account successfully",
          });
        } catch (ex) {
          showSnack({
            key: "login error",
            severity: "error",
            message: "problem trying to link reMarkable account",
          });
        } finally {
          setIncCode("");
          setRegistering(false);
        }
      })(),
    [setRegistering, setIncCode, setOpts],
  );

  if (show) {
    const pasteAdornment = (
      <InputAdornment position="end">
        <Tooltip title="paste code from clipboard">
          <IconButton
            aria-label="paste into input field"
            onClick={clipboard}
            edge="end"
            disabled={registering}
          >
            {registering ? (
              <CircularProgress size={16} />
            ) : (
              <ContentPasteIcon />
            )}
          </IconButton>
        </Tooltip>
      </InputAdornment>
    );

    return (
      <Right>
        <Stack spacing={1}>
          <Alert severity="warning">
            If choosing to upload documents, you must link this extension to
            your reMarkable account
          </Alert>
          <Typography>
            Click{" "}
            <Link
              href="https://my.remarkable.com/device/browser/connect"
              target="_blank"
            >
              here
            </Link>{" "}
            and copy the eight-letter code into the box below to link your
            reMarkable account.
          </Typography>
          <OutlinedInput
            value={incCode}
            disabled={registering}
            onChange={changeAuth}
            endAdornment={pasteAdornment}
            fullWidth={true}
          />
        </Stack>
      </Right>
    );
  } else {
    return null;
  }
}

function RemarkableCssPicker({
  rmCss,
  setOpts,
}: {
  rmCss: boolean | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onToggle = useCallback(
    () =>
      setOpts({
        rmCss: !rmCss,
      }),
    [setOpts, rmCss],
  );
  return (
    <CheckboxSelection
      value={rmCss}
      onToggle={onToggle}
      title="Use reMarkable CSS"
      caption={`The default remarkable css adds some extra margins around
      paragraphs among other changes. Select this to use it.`}
    />
  );
}

function ImageHandlingPicker({
  imageHandling,
  setOpts,
}: {
  imageHandling: ImageHandling | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const change = useCallback(
    (val: ImageHandling) => setOpts({ imageHandling: val }),
    [setOpts],
  );
  return (
    <Section title="Image Handling">
      <RadioSelection
        value={imageHandling}
        onChange={change}
        selections={[
          {
            val: "strip",
            title: "Strip all images",
            caption: `Remove all images from the generated epub. This is
            similar to the way that "Read on reMarkable" works.`,
          },
          {
            val: "filter",
            title: "Filter duplicate images",
            caption: `Only keep the first appearance of any image url. This is
            helpful because sometimes the web page summarization duplicates
            images.`,
          },
          {
            val: "keep",
            title: "Keep all images",
            caption: `Keep all images in the summarized document. Note, this
            will still remove images that couldn't be found.`,
          },
        ]}
      />
    </Section>
  );
}

function CloseImages({
  imageHrefSimilarityThreshold,
  setOpts,
}: {
  imageHrefSimilarityThreshold: number | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onToggle = useCallback(
    () =>
      setOpts({
        imageHrefSimilarityThreshold:
          imageHrefSimilarityThreshold === 0
            ? defaultOptions.imageHrefSimilarityThreshold
            : 0,
      }),
    [setOpts, imageHrefSimilarityThreshold],
  );
  return (
    <CheckboxSelection
      value={imageHrefSimilarityThreshold !== 0}
      onToggle={onToggle}
      title="Match Close Images"
      caption={`Due to a bug in chrome, and potentially other factors,
      capturing the page may get a different image than the ones that appear in
      the captured html. Selecting this causes the extension to do a more
      expensive search for close image urls it has, and uses those iamges
      instead. If images you expect to be present are missing, this may help,
      if images seem out of context, consider disabling this.`}
    />
  );
}

function ImageBrightness({
  imageBrightness,
  setOpts,
}: {
  imageBrightness: number | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onToggle = useCallback(
    () =>
      setOpts({
        imageBrightness:
          imageBrightness === 1 ? defaultOptions.imageBrightness : 1,
      }),
    [setOpts, imageBrightness],
  );
  return (
    <CheckboxSelection
      value={imageBrightness !== 1}
      onToggle={onToggle}
      title="Brighten Images"
      caption={`Due to the fact that reMarkable isn't pure white, images can
      appear darker. Check this to brighten every image so they're easier to
      read on reMarkable.`}
    />
  );
}

function HrefHeader({
  hrefHeader,
  setOpts,
}: {
  hrefHeader: boolean | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onToggle = useCallback(
    () => setOpts({ hrefHeader: !hrefHeader }),
    [setOpts, hrefHeader],
  );
  return (
    <CheckboxSelection
      value={hrefHeader}
      onToggle={onToggle}
      title="Include page URL in epub"
      caption={`Include a small header with the original page URL right above
      the article title when converting an article into an epub.`}
    />
  );
}

function BylineHeader({
  bylineHeader,
  setOpts,
}: {
  bylineHeader: boolean | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onToggle = useCallback(
    () => setOpts({ bylineHeader: !bylineHeader }),
    [setOpts, bylineHeader],
  );
  return (
    <CheckboxSelection
      value={bylineHeader}
      onToggle={onToggle}
      title="Include byline in epub"
      caption={`Include a small byline with the extracted author right below
      the article title when converting an article into an epub.`}
    />
  );
}

function CoverHeader({
  coverHeader,
  setOpts,
}: {
  coverHeader: boolean | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onToggle = useCallback(
    () => setOpts({ coverHeader: !coverHeader }),
    [setOpts, coverHeader],
  );
  return (
    <CheckboxSelection
      value={coverHeader}
      onToggle={onToggle}
      title="Include cover image in epub"
      caption={`Include the extracted cover image right below the article title
      when converting an article into an epub.`}
    />
  );
}

function FilterLinksPicker({
  filterLinks,
  setOpts,
}: {
  filterLinks: boolean | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onToggle = useCallback(
    () => setOpts({ filterLinks: !filterLinks }),
    [setOpts, filterLinks],
  );
  return (
    <CheckboxSelection
      value={filterLinks}
      onToggle={onToggle}
      title="Remove Links"
      caption={`Links are rendered on reMarkable with an underline, but aren't
      navigable. Setting this to true removes the links, decluttering the
      resulting epub.`}
    />
  );
}

function DownloadAskPicker({
  downloadAsk,
  setOpts,
}: {
  downloadAsk: boolean | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onToggle = useCallback(
    () => setOpts({ downloadAsk: !downloadAsk }),
    [setOpts, downloadAsk],
  );
  return (
    <CheckboxSelection
      value={downloadAsk}
      onToggle={onToggle}
      title="Ask for Filename"
      caption={`When downloading as a file, ask where to save each file.`}
    />
  );
}

function CoverOptions({
  cover,
  setOpts,
}: {
  cover: Cover | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onToggle = useCallback(
    () => setOpts({ cover: cover === "first" ? "visited" : "first" }),
    [setOpts, cover],
  );
  return (
    <CheckboxSelection
      value={cover === "visited"}
      onToggle={onToggle}
      title="Use Last Page Visited as Cover"
      caption={`If checked, the last visited page will be displayed as the
      cover. If not, the first page will be.`}
    />
  );
}

const maison = "Maison Neue";

function FontPicker({
  fontName,
  setOpts,
}: {
  fontName: string | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onToggle = useCallback(
    () => setOpts({ fontName: fontName === maison ? "" : maison }),
    [setOpts, fontName],
  );
  return (
    <CheckboxSelection
      value={fontName === maison}
      onToggle={onToggle}
      title="Use Maison Neue as Default Font"
      caption={`If checked, the default font will be set to Miason Neue,
      otherwise no default font will be set, and reMarkable will likely default
      to EB Garamond.`}
    />
  );
}

const allowedMargins = [
  { value: 0, label: "none" },
  { value: 50, label: "small" },
  { value: 125, label: "medium" },
  { value: 180, label: "read" },
  { value: 200, label: "large" },
];
function MarginsPicker({
  margins,
  setOpts,
}: {
  margins: number | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onChange = useCallback(
    (val: number) => setOpts({ margins: val }),
    [setOpts],
  );
  return (
    <SliderSelection
      title="Margins"
      caption={`Set the page margins. "small", "medium", and "large" correspond
      to the options in "Text Settings", while "read" is the default margins
      for Read on reMarkable.`}
      value={margins}
      onChange={onChange}
      options={allowedMargins}
    />
  );
}

const allowedScales = [
  { value: 0.7, label: "tiny" },
  { value: 0.8, label: "small" },
  { value: 1.0, label: "medium" },
  { value: 1.2, label: "large" },
  { value: 1.5, label: "extra large" },
  { value: 2.0, label: "xx large" },
];
function TextScalePicker({
  textScale,
  setOpts,
}: {
  textScale: number | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onChange = useCallback(
    (val: number) => setOpts({ textScale: val }),
    [setOpts],
  );
  return (
    <SliderSelection
      title="Text Scale"
      caption={`Set the text scaling. Each of these corresponds to a setting in "Text Settings".`}
      value={textScale}
      onChange={onChange}
      options={allowedScales}
    />
  );
}

function TextAlignmentPicker({
  textAlignment,
  setOpts,
}: {
  textAlignment: TextAlignment | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onChange = useCallback(
    (change: TextAlignment) => setOpts({ textAlignment: change }),
    [setOpts],
  );
  return (
    <ButtonSelection
      value={textAlignment}
      onChange={onChange}
      title="Text Alignment"
      caption={`Set the text alignment for upload. These are the same options presented
        in the "Text Settings" menu.`}
      selections={[
        { val: "justify", icon: <FormatAlignJustifyIcon /> },
        { val: "left", icon: <FormatAlignLeftIcon /> },
      ]}
    />
  );
}

function LineHeightPicker({
  lineHeight,
  setOpts,
}: {
  lineHeight: number | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onChange = useCallback(
    (change: "small" | "medium" | "large" | "unknown") =>
      setOpts({
        lineHeight: change === "large" ? 200 : change === "medium" ? 150 : 100,
      }),
    [setOpts],
  );
  const value =
    lineHeight === 200
      ? "large"
      : lineHeight === 150
      ? "medium"
      : lineHeight === 100
      ? "small"
      : "unknown";
  return (
    <ButtonSelection
      value={value}
      onChange={onChange}
      title="Line Height"
      caption={`Set the line height. These are the same options as available in
      the "Text Settings" menu`}
      selections={[
        { val: "small", icon: <DensitySmallIcon /> },
        { val: "medium", icon: <DensityMediumIcon /> },
        { val: "large", icon: <DensityLargeIcon /> },
      ]}
    />
  );
}

export function SignOut({
  deviceToken,
  setOpts,
}: {
  deviceToken: string | undefined;
  setOpts: SetOptions;
}): ReactElement | null {
  const signout = useCallback(() => setOpts({ deviceToken: "" }), [setOpts]);

  if (deviceToken || deviceToken === undefined) {
    return (
      <Button
        variant="outlined"
        disabled={deviceToken === undefined}
        onClick={signout}
      >
        Disconnect from your reMarkable account
      </Button>
    );
  } else {
    return null;
  }
}

function close(): void {
  window.close();
}

function Done(): ReactElement {
  return (
    <Right>
      <Button variant="contained" onClick={close} fullWidth={true}>
        Done
      </Button>
    </Right>
  );
}

function SignInOptions({
  opts,
  setOpts,
  showSnack,
}: {
  opts: Partial<Options>;
  setOpts: SetOptions;
  showSnack: (snk: Snack) => void;
}): ReactElement {
  const { deviceToken, outputStyle } = opts;
  const showSignIn =
    outputStyle === "download"
      ? false
      : deviceToken === undefined
      ? undefined
      : !deviceToken;

  const title = <Typography variant="h4">reMarkable ePub Options</Typography>;
  return (
    <Stack spacing={2}>
      <LeftRight sx={{ mt: "80px" }} label={title}>
        <StaticImage alt="repub" src={`repub.svg`} width={48} height={48} />
      </LeftRight>
      <OutputStylePicker outputStyle={outputStyle} setOpts={setOpts} />
      <SignIn show={showSignIn} setOpts={setOpts} showSnack={showSnack} />
    </Stack>
  );
}

function EpubOptions({
  opts,
  setOpts,
}: {
  opts: Partial<Options>;
  setOpts: SetOptions;
}): ReactElement {
  return (
    <Section
      title="ePub Options"
      subtitle={`These options alter the way the epub is generated independent of
          whether it's uploaded to reMarkable or kept as an epub`}
    >
      <CloseImages
        imageHrefSimilarityThreshold={opts.imageHrefSimilarityThreshold}
        setOpts={setOpts}
      />
      <ImageBrightness
        imageBrightness={opts.imageBrightness}
        setOpts={setOpts}
      />
      <HrefHeader hrefHeader={opts.hrefHeader} setOpts={setOpts} />
      <BylineHeader bylineHeader={opts.bylineHeader} setOpts={setOpts} />
      <CoverHeader coverHeader={opts.coverHeader} setOpts={setOpts} />
      <RemarkableCssPicker rmCss={opts.rmCss} setOpts={setOpts} />
      <FilterLinksPicker filterLinks={opts.filterLinks} setOpts={setOpts} />
    </Section>
  );
}

function UploadOptions({
  opts,
  setOpts,
}: {
  opts: Partial<Options>;
  setOpts: SetOptions;
}): ReactElement | null {
  return (
    <Section
      title="Upload Options"
      subtitle={`These are reMarkable specific options that can only be
        enabled if your account is linked.`}
    >
      <CoverOptions cover={opts.cover} setOpts={setOpts} />
      <FontPicker fontName={opts.fontName} setOpts={setOpts} />
      <TextAlignmentPicker
        textAlignment={opts.textAlignment}
        setOpts={setOpts}
      />
      <LineHeightPicker lineHeight={opts.lineHeight} setOpts={setOpts} />
      <MarginsPicker margins={opts.margins} setOpts={setOpts} />
      <TextScalePicker textScale={opts.textScale} setOpts={setOpts} />
    </Section>
  );
}

function DownloadOptions({
  opts,
  setOpts,
}: {
  opts: Partial<Options>;
  setOpts: SetOptions;
}): ReactElement | null {
  return (
    <Section
      title="Download Options"
      subtitle={`These are options that are only relevant if you're downloading
      articles as files.`}
    >
      <DownloadAskPicker downloadAsk={opts.downloadAsk} setOpts={setOpts} />
    </Section>
  );
}

interface Snack {
  key: string;
  severity: AlertColor;
  message: string;
}

export default function OptionsPage(): ReactElement {
  // snack bar
  const [open, setOpen] = useState(false);
  const [snack, setSnack] = useState<Snack>({
    key: "",
    severity: "info",
    message: "",
  });
  const close = useCallback(() => setOpen(false), [setOpen]);
  const showSnack = useCallback(
    (snk: Snack) => {
      setSnack(snk);
      setOpen(true);
    },
    [setOpen, setSnack],
  );

  // options
  const [opts, setOptsState] = useState(unknownOpts);

  const setOpts = useCallback(
    (options: Partial<Options>) => {
      setOptsState({ ...opts, ...options });
      void setOptions(options);
    },
    [opts, setOptsState],
  );

  useEffect(() => {
    if (opts === unknownOpts) {
      getOptions().then(setOpts, () => {
        showSnack({
          key: "reset options",
          severity: "warning",
          message: "problem reading options; resetting to default",
        });
        setOpts(defaultOptions);
      });
    }
  }, [opts === unknownOpts]);

  const { deviceToken } = opts;

  return (
    <ThemeProvider theme={theme}>
      <Head>
        <title>reMarkable ePub Options</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Box sx={{ backgroundColor: "#0b212e" }}>
        <Box
          sx={{
            bgcolor: "background.paper",
            maxWidth: "700px",
            width: "100%",
            padding: 0,
            margin: "0 auto",
          }}
        >
          <Stack justifyContent="space-between" sx={{ minHeight: "100vh" }}>
            <Container maxWidth="sm" sx={{ padding: 4 }}>
              <Stack spacing={4}>
                <SignInOptions
                  opts={opts}
                  setOpts={setOpts}
                  showSnack={showSnack}
                />
                <Box>
                  <ImageHandlingPicker
                    imageHandling={opts.imageHandling}
                    setOpts={setOpts}
                  />
                  <EpubOptions opts={opts} setOpts={setOpts} />
                  <UploadOptions opts={opts} setOpts={setOpts} />
                  <DownloadOptions opts={opts} setOpts={setOpts} />
                </Box>
                <Done />
              </Stack>
            </Container>
            <Box sx={{ backgroundColor: "#ebebeb" }}>
              <Container maxWidth="sm" sx={{ padding: 4 }}>
                <Stack>
                  <SignOut deviceToken={deviceToken} setOpts={setOpts} />
                </Stack>
              </Container>
            </Box>
          </Stack>
        </Box>
      </Box>
      <Snackbar open={open} autoHideDuration={6000} onClose={close}>
        <Alert
          onClose={close}
          key={snack.key}
          severity={snack.severity}
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
