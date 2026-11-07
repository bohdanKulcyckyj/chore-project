export interface DraftItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  totalPrice: number;
}

export interface DraftPurchase {
  shop: string;
  purchasedAt: Date;
  total: number;
  items: DraftItem[];
}

export interface ReceiptFormat {
  shop: string;
  detect: (text: string) => boolean;
  parse: (text: string) => DraftPurchase;
}

/** A file handed to the pipeline. `name` decides the format when the platform
 * supplied no MIME type, or the wrong one — some pickers leave `type` empty. */
export interface ReceiptSource {
  name: string;
  type?: string;
  data: ArrayBuffer | Uint8Array | Blob;
}

/** File → plain text. One per input format, registered in ./extractors. */
export interface TextExtractor {
  name: string;
  supports: (source: ReceiptSource) => boolean;
  extract: (source: ReceiptSource) => Promise<string>;
}

/** What a receipt import produced. A union rather than exceptions-plus-toasts,
 * so the pipeline carries no UI dependency and the caller must handle the
 * failure cases explicitly. */
export type ImportOutcome =
  | { status: "parsed"; draft: DraftPurchase } // a shop format matched
  | { status: "guessed"; draft: DraftPurchase } // generic scraper
  | { status: "illegible"; hint: string } // read, but nothing usable in it
  | { status: "unsupported"; hint: string }; // could not read the file at all
