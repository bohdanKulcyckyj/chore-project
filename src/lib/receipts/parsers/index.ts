import { ShopParser } from '../types';
import { albertParser } from './albert';
import { ikeaParser } from './ikea';
import { kauflandParser } from './kaufland';
import { lidlParser } from './lidl';

export const parsers: ShopParser[] = [albertParser, ikeaParser, kauflandParser, lidlParser];

/** Returns the parser whose detect() matches, or undefined for unknown shops. */
export function detectParser(text: string): ShopParser | undefined {
  return parsers.find((p) => p.detect(text));
}
