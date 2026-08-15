// Full file→extract→parse run over the real receipts in receipts/ (gitignored,
// personal data) — runs locally only, skipped when the folder is absent.
// Pass gate per receipt: shop detected, date parsed, every item named+priced,
// |Σ item totals − receipt total| < 0.01 Kč.
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { extractText } from '../lib/receipts/extractText';
import { detectParser } from '../lib/receipts/parsers';

const RECEIPTS_DIR = join(process.cwd(), 'receipts');
const SHOPS: Record<string, string> = { albert: 'Albert', kaufland: 'Kaufland', lidl: 'Lidl' };

describe.skipIf(!existsSync(RECEIPTS_DIR))('real receipts pipeline', () => {
  for (const [folder, shop] of Object.entries(SHOPS)) {
    const dir = join(RECEIPTS_DIR, folder);
    const files = existsSync(dir) ? readdirSync(dir) : [];
    for (const file of files) {
      // OCR of a full receipt photo takes ~30s in Node
      it(`${folder}/${file}`, { timeout: 120_000 }, async () => {
        const text = await extractText(new Uint8Array(readFileSync(join(dir, file))), file);
        const parser = detectParser(text);
        expect(parser?.shop).toBe(shop);
        const result = parser!.parse(text);
        expect(result.purchasedAt.getTime()).not.toBeNaN();
        expect(result.items.length).toBeGreaterThan(0);
        for (const item of result.items) {
          expect(item.name).not.toBe('');
          expect(Number.isFinite(item.totalPrice)).toBe(true);
        }
        const sum = result.items.reduce((s, i) => s + i.totalPrice, 0);
        expect(Math.abs(sum - result.total)).toBeLessThan(0.01);
        if (process.env.PRINT) {
          console.log(`\n${shop} ${result.purchasedAt.toLocaleString('cs-CZ')} — total ${result.total}`);
          for (const i of result.items) console.log(`  ${i.name}  ${i.quantity}× → ${i.totalPrice}`);
        }
      });
    }
  }
});
