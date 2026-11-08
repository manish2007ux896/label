// FILE: src/core/pdf/dynamicAnchorFinder.ts
import type { ReconstructedLine } from './textReconstructor';

/**
 * Dynamically finds the Y-coordinate of the TAX INVOICE divider line.
 * In Indian marketplace PDFs (Meesho, Flipkart, Shopsy), the top half contains
 * the courier shipping label, and the bottom half contains the tax invoice.
 * When a buyer enters a long 5-line address with landmarks, the divider shifts downward.
 */
export function findTaxInvoiceDividerY(
  lines: ReconstructedLine[],
  defaultFallbackY: number = 404.0
): number {
  for (const line of lines) {
    if (
      /\b(TAX\s+INVOICE|BILL\s+OF\s+SUPPLY|CUSTOMER\s+INVOICE|FOLD\s+HERE)\b/i.test(line.text) &&
      line.y_top > 220 &&
      line.y_top < 560
    ) {
      // Return 8pt safety margin above the TAX INVOICE line
      return Math.max(340, Math.min(520, line.y_top - 8.0));
    }
  }
  return defaultFallbackY;
}
