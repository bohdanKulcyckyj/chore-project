import { ReceiptSource, TextExtractor } from "../types";
import { toOcrInput } from "./runtime";

const IMAGE_EXT = /\.(png|jpe?g|webp|bmp|tiff?)$/i;

/** HEIF (and Apple's HEIC flavour of it) cannot be decoded by tesseract.
 * iOS transcodes to JPEG when a photo goes through a file input, so this only
 * shows up when a HEIF is dragged in from a desktop photo library. Detected
 * here so the caller can say something useful instead of failing in OCR. */
export const isHeif = (source: ReceiptSource): boolean =>
  /\.hei[cf]$/i.test(source.name) || /^image\/hei[cf]/i.test(source.type ?? "");

export async function extractImageText(
  image: Blob | Uint8Array | string,
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("ces");
  try {
    const { data } = await worker.recognize(
      toOcrInput(image) as Parameters<typeof worker.recognize>[0],
    );
    return data.text;
  } finally {
    await worker.terminate();
  }
}

export const imageExtractor: TextExtractor = {
  name: "image",
  supports: (source: ReceiptSource) =>
    !isHeif(source) &&
    (IMAGE_EXT.test(source.name) ||
      (source.type ?? "").startsWith("image/")),
  extract: (source: ReceiptSource) =>
    extractImageText(source.data as Blob | Uint8Array),
};
