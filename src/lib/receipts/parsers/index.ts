import { ReceiptFormat } from '../types';
import { albertPaperFormat } from './albertPaper';
import { albertPdfFormat } from './albertPdf';
import { ikeaParser } from './ikea';
import { kauflandParser } from './kaufland';
import { lidlParser } from './lidl';

export const parsers: ReceiptFormat[] = [albertPaperFormat, albertPdfFormat, ikeaParser, kauflandParser, lidlParser];

/** Returns the parser whose detect() matches, or undefined for unknown shops. */
export function detectParser(text: string): ReceiptFormat | undefined {
  return parsers.find((p) => p.detect(text));
}
