// bundled by bun into out/ so the options page loads the pdfjs worker from the
// extension's own origin (the default MV3 CSP blocks blob/eval workers)
import "pdfjs-dist/build/pdf.worker.min.mjs";
