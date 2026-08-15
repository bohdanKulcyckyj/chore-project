// File/buffer → plain text. PDF via pdfjs-dist text layer, images via tesseract.js OCR.
// Runs in Node (tests, no worker) and browser (Phase 4, real workers).

const isNode = typeof window === 'undefined';

type PdfTextItem = { str: string; transform: number[]; width: number };

async function getPdfjs() {
  if (isNode) {
    // legacy build runs on Node's fake worker without setup
    return import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

/** Rebuild text lines from pdfjs text items: group by y (2pt tolerance), sort by x.
 * Adjacent items are joined without a space when they touch (pdfjs splits words
 * at diacritics, e.g. "P|ř|epravka"). */
function itemsToLines(items: PdfTextItem[]): string[] {
  const rows: { y: number; parts: { x: number; width: number; str: string }[] }[] = [];
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
    let line = '';
    let prevEnd = -Infinity;
    for (const p of parts) {
      if (line && p.x - prevEnd > 1) line += ' ';
      line += p.str;
      prevEnd = p.x + p.width;
    }
    return line.replace(/\s+/g, ' ').trim();
  });
}

export async function extractPdfText(data: ArrayBuffer | Uint8Array): Promise<string> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: data instanceof Uint8Array ? data : new Uint8Array(data) }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    lines.push(...itemsToLines(content.items as PdfTextItem[]));
  }
  await doc.cleanup?.();
  return lines.join('\n');
}

export async function extractImageText(image: Blob | Uint8Array | string): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('ces');
  try {
    // tesseract.js accepts Blob/File (browser), Buffer or file path (Node)
    const input = image instanceof Uint8Array && isNode ? Buffer.from(image) : image;
    const { data } = await worker.recognize(input as Parameters<typeof worker.recognize>[0]);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

/** Dispatch by file type. `name` decides pdf vs image. */
export async function extractText(data: ArrayBuffer | Uint8Array | Blob, name: string): Promise<string> {
  if (/\.pdf$/i.test(name)) {
    const buf = data instanceof Blob ? await data.arrayBuffer() : data;
    return extractPdfText(buf);
  }
  return extractImageText(data as Blob | Uint8Array);
}
