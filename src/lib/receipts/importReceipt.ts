import { ImportOutcome, ReceiptSource, TextExtractor } from "./types";
import { isHeif, selectExtractor } from "./extractors";
import { detectParser } from "./parsers";
import { genericFormat } from "./parsers/generic";

const RETAKE =
  "Could not read any items. Photograph the receipt straight on, fill the frame, and avoid shadows.";

type ExtractorLookup = (source: ReceiptSource) => TextExtractor | undefined;

/** Facade over the whole pipeline: files in, a draft purchase out.
 *
 * Several sources are treated as pages of ONE receipt — a long receipt needs
 * two photos — so their text is concatenated before a single parse.
 *
 * `selectFor` is injected only so tests can drive the outcomes without running
 * real OCR; production always uses the registry default. */
export async function importReceipt(
  sources: ReceiptSource[],
  selectFor: ExtractorLookup = selectExtractor,
): Promise<ImportOutcome> {
  if (sources.length === 0) {
    return { status: "unsupported", hint: "No file to read." };
  }

  const pages: string[] = [];
  for (const source of sources) {
    const extractor = selectFor(source);
    if (!extractor) {
      return {
        status: "unsupported",
        hint: isHeif(source)
          ? "HEIF photos cannot be read. Take the photo in the app, or export it as JPEG."
          : `Cannot read "${source.name}". Use a PDF, JPEG or PNG.`,
      };
    }
    try {
      pages.push(await extractor.extract(source));
    } catch (error) {
      return {
        status: "unsupported",
        hint: error instanceof Error ? error.message : `Could not read "${source.name}".`,
      };
    }
  }

  const text = pages.join("\n");
  const format = detectParser(text);
  const draft = (format ?? genericFormat).parse(text);

  // No items means OCR produced nothing a parser could use — almost always a
  // blurry or cropped photo, so say that rather than opening an empty form.
  if (draft.items.length === 0) return { status: "illegible", hint: RETAKE };

  return format ? { status: "parsed", draft } : { status: "guessed", draft };
}
