import { ReceiptSource, TextExtractor } from "../types";
import { pdfWorkerUrl } from "./runtime";

type PdfTextItem = { str: string; transform: number[]; width: number };

async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const url = pdfWorkerUrl();
  if (url) pdfjs.GlobalWorkerOptions.workerSrc = url;
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

export const pdfExtractor: TextExtractor = {
  name: "pdf",
  supports: (source: ReceiptSource) =>
    /\.pdf$/i.test(source.name) || source.type === "application/pdf",
  extract: async (source: ReceiptSource) => {
    const data =
      source.data instanceof Blob ? await source.data.arrayBuffer() : source.data;
    return extractPdfText(data);
  },
};
