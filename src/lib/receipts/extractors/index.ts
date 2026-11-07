import { ReceiptSource, TextExtractor } from "../types";
import { imageExtractor } from "./image";
import { pdfExtractor } from "./pdf";

/** Registry, mirroring `parsers[]`: adding a format means adding an entry,
 * never editing a dispatch function. */
export const extractors: TextExtractor[] = [pdfExtractor, imageExtractor];

/** Returns the extractor that handles this file, or undefined when none does. */
export function selectExtractor(
  source: ReceiptSource,
): TextExtractor | undefined {
  return extractors.find((e) => e.supports(source));
}

export { extractPdfText } from "./pdf";
export { extractImageText, isHeif } from "./image";
