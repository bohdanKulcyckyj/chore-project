// File/buffer → plain text. PDF via pdfjs-dist text layer, images via tesseract.js OCR.
// Runs in Node (tests, no worker) and browser (Phase 4, real workers).

// v4 legacy build: polyfilled for iOS/Safari 15.4+ (v5+ legacy needs 17.4+)
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

// process-based, not window-based: vitest's happy-dom has a window but must
// still use pdfjs's Node fake worker (no real Worker to spawn)
const isNode =
  typeof process !== "undefined" && process.versions?.node != null;

type PdfTextItem = { str: string; transform: number[]; width: number };

async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Node (tests) uses pdfjs's built-in fake worker; browser needs the real one
  if (!isNode) pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

/** Rebuild text lines from pdfjs text items: group by y (2pt tolerance), sort by x.
 * Adjacent items are joined without a space when they touch (pdfjs splits words
 * at diacritics, e.g. "P|ř|epravka"). */
function itemsToLines(items: PdfTextItem[]): string[] {
  const rows: {
    y: number;
    parts: { x: number; width: number; str: string }[];
  }[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    const row = rows.find((r) => Math.abs(r.y - y) < 2);
    const part = { x, width: it.width, str: it.str };
    if (row) row.parts.push(part);
    else rows.push({ y, parts: [part] });
  }
  rows.sort((a, b) => b.y - a.y); // PDF y grows upward
  return rows.map((r) => {
    const parts = r.parts.sort((a, b) => a.x - b.x);
    let line = "";
    let prevEnd = -Infinity;
    for (const p of parts) {
      if (line && p.x - prevEnd > 1) line += " ";
      line += p.str;
      prevEnd = p.x + p.width;
    }
    return line.replace(/\s+/g, " ").trim();
  });
}

export async function extractPdfText(
  data: ArrayBuffer | Uint8Array,
): Promise<string> {
  try {
    const pdfjs = await getPdfjs();
    const loadingTask = pdfjs.getDocument({
      data: data instanceof Uint8Array ? data : new Uint8Array(data),
      verbosity: 0,
    });
    const doc = await loadingTask.promise;

    const lines: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      lines.push(...itemsToLines(content.items as PdfTextItem[]));
    }
    await doc.cleanup();
    return lines.join("\n");
  } catch (error) {
    console.error("[PDF.js] Extraction failed:", error);
    throw new Error(
      `PDF extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function extractImageText(
  image: Blob | Uint8Array | string,
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("ces");
  try {
    // tesseract.js accepts Blob/File (browser), Buffer or file path (Node)
    const input =
      image instanceof Uint8Array && isNode ? Buffer.from(image) : image;
    const { data } = await worker.recognize(
      input as Parameters<typeof worker.recognize>[0],
    );
    return data.text;
  } finally {
    await worker.terminate();
  }
}

/** Dispatch by file type. `name` decides pdf vs image. */
export async function extractText(
  data: ArrayBuffer | Uint8Array | Blob,
  name: string,
): Promise<string> {
  if (/\.pdf$/i.test(name)) {
    const buf = data instanceof Blob ? await data.arrayBuffer() : data;
    return extractPdfText(buf);
  }
  return extractImageText(data as Blob | Uint8Array);
}
