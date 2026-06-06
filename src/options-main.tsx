import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/noto-sans/latin-400.css";
import "@fontsource/noto-serif/latin-400.css";
import "@fontsource/noto-sans-mono/latin-400.css";
import { createRoot } from "react-dom/client";
import OptionsPage from "../components/options-page";

const container = document.getElementById("root")!;
createRoot(container).render(<OptionsPage />);
