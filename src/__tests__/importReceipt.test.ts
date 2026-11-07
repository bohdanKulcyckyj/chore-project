import { describe, expect, it } from "vitest";
import { importReceipt } from "../lib/receipts/importReceipt";
import { ReceiptSource, TextExtractor } from "../lib/receipts/types";

// The payoff of the extractor registry: the whole pipeline is drivable without
// pdfjs, tesseract or React. `text` stands in for whatever OCR would return.
const fakeExtractor = (text: string): TextExtractor => ({
  name: "fake",
  supports: () => true,
  extract: async () => text,
});

const source = (name = "receipt.jpg"): ReceiptSource => ({
  name,
  type: "image/jpeg",
  data: new Uint8Array(),
});

const ALBERT_PAPER = `albert Nadrazni 2855/147
| ALBERT TP SVR BR 69,90 B a
Celkem 69,90
17.10.26 1 0382`;

const UNKNOWN_SHOP = `BILLA Praha 4
Rohlik 3,50 B
Celkem 3,50
Datum 07.11.26`;

describe("importReceipt", () => {
  it("reports `parsed` when a shop format matches", async () => {
    const outcome = await importReceipt([source()], () =>
      fakeExtractor(ALBERT_PAPER),
    );
    expect(outcome.status).toBe("parsed");
    if (outcome.status !== "parsed") return;
    expect(outcome.draft.shop).toBe("Albert");
    expect(outcome.draft.total).toBe(69.9);
  });

  it("reports `guessed` for an unknown shop, leaving the shop blank", async () => {
    const outcome = await importReceipt([source()], () =>
      fakeExtractor(UNKNOWN_SHOP),
    );
    expect(outcome.status).toBe("guessed");
    if (outcome.status !== "guessed") return;
    expect(outcome.draft.shop).toBe("");
    expect(outcome.draft.items).toHaveLength(1);
  });

  it("reports `illegible` when OCR yields nothing usable", async () => {
    // the real output of a 387x516 photo of a receipt
    const outcome = await importReceipt([source()], () =>
      fakeExtractor("alberrt\nSka.\nNJN HW HDP DDODNNWNYJL"),
    );
    expect(outcome.status).toBe("illegible");
    if (outcome.status !== "illegible") return;
    expect(outcome.hint).toMatch(/Photograph the receipt/);
  });

  it("reports `unsupported` with HEIF-specific advice", async () => {
    const outcome = await importReceipt(
      [{ name: "IMG_0042.HEIC", type: "image/heic", data: new Uint8Array() }],
      () => undefined,
    );
    expect(outcome.status).toBe("unsupported");
    if (outcome.status !== "unsupported") return;
    expect(outcome.hint).toMatch(/HEIF/);
  });

  it("reports `unsupported` when an extractor throws", async () => {
    const outcome = await importReceipt([source()], () => ({
      name: "boom",
      supports: () => true,
      extract: async () => {
        throw new Error("PDF extraction failed: bad xref");
      },
    }));
    expect(outcome).toEqual({
      status: "unsupported",
      hint: "PDF extraction failed: bad xref",
    });
  });

  it("treats several files as pages of one receipt", async () => {
    // The shop marker is only on page 1 and the total only on page 2, so
    // albertPaper's detect can only match once the pages are concatenated.
    const pages = [
      "albert\n| AAA PRVNI 10,00 A",
      "| BBB DRUHA 20,00 A\nCelkem 30,00\n17.10.26",
    ];
    let page = 0;
    const outcome = await importReceipt([source(), source()], () =>
      fakeExtractor(pages[page++]),
    );
    expect(outcome.status).toBe("parsed");
    if (outcome.status !== "parsed") return;
    expect(outcome.draft.items.map((i) => i.totalPrice)).toEqual([10, 20]);
    expect(outcome.draft.total).toBe(30);
  });

  it("reports `unsupported` for no files", async () => {
    expect((await importReceipt([])).status).toBe("unsupported");
  });
});
