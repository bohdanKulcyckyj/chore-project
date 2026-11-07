import { ReceiptFormat } from '../types';
import { albertPaperFormat } from './albertPaper';
import { albertPdfFormat } from './albertPdf';
import { ikeaParser } from './ikea';
import { kauflandParser } from './kaufland';
import { lidlParser } from './lidl';
import { pennyFormat } from './penny';

export const parsers: ReceiptFormat[] = [albertPaperFormat, albertPdfFormat, ikeaParser, kauflandParser, lidlParser, pennyFormat];

/** Returns the parser whose detect() matches, or undefined for unknown shops. */
export function detectParser(text: string): ReceiptFormat | undefined {
  return parsers.find((p) => p.detect(text));
}
