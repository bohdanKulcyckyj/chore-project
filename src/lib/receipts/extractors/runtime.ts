// The ONLY place in the receipt pipeline that branches on Node vs browser.
// Everything else stays environment-agnostic.

// v4 legacy build: polyfilled for iOS/Safari 15.4+ (v5+ legacy needs 17.4+)
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

// process-based, not window-based: vitest's happy-dom has a window but must
// still use pdfjs's Node fake worker (no real Worker to spawn)
export const isNode =
  typeof process !== "undefined" && process.versions?.node != null;

/** Browser needs the real pdfjs worker; Node uses pdfjs's built-in fake one. */
export const pdfWorkerUrl = (): string | null => (isNode ? null : workerUrl);

/** tesseract.js accepts Blob/File in the browser, Buffer or a path in Node. */
export function toOcrInput(
  image: Blob | Uint8Array | string,
): Blob | Uint8Array | string {
  return image instanceof Uint8Array && isNode ? Buffer.from(image) : image;
}
