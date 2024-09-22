import ContentPasteIcon from "@mui/icons-material/ContentPaste";
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
import CheckboxSelection from "../components/checkbox-selection";
import LeftRight from "../components/left-right";
import RadioSelection from "../components/radio-selection";
import Right from "../components/right";
import Section from "../components/section";
import StaticImage from "../components/static-image";
import {
  defaultOptions,
  getOptions,
  ImageHandling,
  Options,
  OutputStyle,
  setOptions,
  SetOptions,
} from "../src/options";
import { sleep } from "../src/utils";

const theme = createTheme({
  palette: {
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
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
    (val: OutputStyle) => {
      setOpts({ outputStyle: val });
    },
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
        } catch {
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
        } catch {
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
          <Link
            href="https://my.remarkable.com/device/browser/connect"
            target="_blank"
          >
            <Button variant="contained" fullWidth={true}>
              Get one-time code
            </Button>
          </Link>
          <Typography>
            Click the button above to copy an eight-letter one time code
            authorizing connection to your reMarkable account, then paste it
            below, or click the clipboard paste icon.
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
  const onToggle = useCallback(() => {
    setOpts({
      rmCss: !rmCss,
    });
  }, [setOpts, rmCss]);
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

function CodeCssPicker({
  codeCss,
  setOpts,
}: {
  codeCss: boolean | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onToggle = useCallback(() => {
    setOpts({
      codeCss: !codeCss,
    });
  }, [setOpts, codeCss]);
  return (
    <CheckboxSelection
      value={codeCss}
      onToggle={onToggle}
      title="Use code environment CSS"
      caption={`This renders <pre/> and <code/> tags in a wrapped fixed-width
      font with a light gray background.`}
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
    (val: ImageHandling) => {
      setOpts({ imageHandling: val });
    },
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
            // eslint-disable-next-line spellcheck/spell-checker
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
  const onToggle = useCallback(() => {
    setOpts({
      imageHrefSimilarityThreshold:
        imageHrefSimilarityThreshold === 0
          ? defaultOptions.imageHrefSimilarityThreshold
          : 0,
    });
  }, [setOpts, imageHrefSimilarityThreshold]);
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
  const onToggle = useCallback(() => {
    setOpts({
      imageBrightness:
        imageBrightness === 1 ? defaultOptions.imageBrightness : 1,
    });
  }, [setOpts, imageBrightness]);
  return (
    <CheckboxSelection
      value={imageBrightness !== 1}
      onToggle={onToggle}
      title="Brighten Images"
      caption={`Due to the fact that reMarkable isn't pure white, images can
      appear darker. Check this to brighten every image so they're easier to
      read on reMarkable. You should generally not use this on reMarkable Paper
      Pro.`}
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
  const onToggle = useCallback(() => {
    setOpts({ hrefHeader: !hrefHeader });
  }, [setOpts, hrefHeader]);
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
  const onToggle = useCallback(() => {
    setOpts({ bylineHeader: !bylineHeader });
  }, [setOpts, bylineHeader]);
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
  const onToggle = useCallback(() => {
    setOpts({ coverHeader: !coverHeader });
  }, [setOpts, coverHeader]);
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

function AuthorByline({
  authorByline,
  setOpts,
}: {
  authorByline: boolean | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onToggle = useCallback(() => {
    setOpts({ authorByline: !authorByline });
  }, [setOpts, authorByline]);
  return (
    <CheckboxSelection
      value={authorByline}
      onToggle={onToggle}
      title="Use article author instead of byline"
      caption={`Some articles list the publication as the byline. If this is
      true, also include the author if found.`}
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
  const onToggle = useCallback(() => {
    setOpts({ filterLinks: !filterLinks });
  }, [setOpts, filterLinks]);
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

function FilterIframesPicker({
  filterIframes,
  setOpts,
}: {
  filterIframes: boolean | undefined;
  setOpts: SetOptions;
}): ReactElement {
  const onToggle = useCallback(() => {
    setOpts({ filterIframes: !filterIframes });
  }, [setOpts, filterIframes]);
  return (
    <CheckboxSelection
      value={filterIframes}
      onToggle={onToggle}
      title="Remove IFrames"
      caption={`Some pages may include relevant information in iframes.
      ReMarkable doesn't natively render these, but by disabling this, we'll
      copy the contents of preserved iframes into the epub contents.`}
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
  const onToggle = useCallback(() => {
    setOpts({ downloadAsk: !downloadAsk });
  }, [setOpts, downloadAsk]);
  return (
    <CheckboxSelection
      value={downloadAsk}
      onToggle={onToggle}
      title="Ask for Filename"
      caption={`When downloading as a file, ask where to save each file.`}
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
  const signout = useCallback(() => {
    setOpts({ deviceToken: "" });
  }, [setOpts]);

  if (deviceToken ?? true) {
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
      <AuthorByline authorByline={opts.authorByline} setOpts={setOpts} />
      <CoverHeader coverHeader={opts.coverHeader} setOpts={setOpts} />
      <RemarkableCssPicker rmCss={opts.rmCss} setOpts={setOpts} />
      <CodeCssPicker codeCss={opts.codeCss} setOpts={setOpts} />
      <FilterLinksPicker filterLinks={opts.filterLinks} setOpts={setOpts} />
      <FilterIframesPicker
        filterIframes={opts.filterIframes}
        setOpts={setOpts}
      />
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
  const close = useCallback(() => {
    setOpen(false);
  }, [setOpen]);
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
        {/* eslint-disable-next-line spellcheck/spell-checker */}
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Box
        sx={{
          maxWidth: "700px",
          width: "100%",
          padding: 0,
          margin: "0 auto",
        }}
      >
        {/* eslint-disable-next-line spellcheck/spell-checker */}
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
                <DownloadOptions opts={opts} setOpts={setOpts} />
              </Box>
              <Done />
            </Stack>
          </Container>
          <Box>
            <Container maxWidth="sm" sx={{ padding: 4 }}>
              <Stack>
                <SignOut deviceToken={deviceToken} setOpts={setOpts} />
              </Stack>
            </Container>
          </Box>
        </Stack>
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
