// Thin compatibility wrapper over the extractor registry in ./extractors.
// Kept because pipeline.test.ts and extractText.browser.test.ts drive the
// pipeline through this signature.
import { selectExtractor } from "./extractors";

export { extractPdfText, extractImageText } from "./extractors";

/** File/buffer → plain text, via whichever registered extractor supports it. */
export async function extractText(
  data: ArrayBuffer | Uint8Array | Blob,
  name: string,
  type?: string,
): Promise<string> {
  const source = { name, type, data };
  const extractor = selectExtractor(source);
  if (!extractor) throw new Error(`No extractor for "${name}"`);
  return extractor.extract(source);
}
