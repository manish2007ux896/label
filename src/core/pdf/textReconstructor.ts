// FILE: src/core/pdf/textReconstructor.ts

export interface RawPdfTextItem {
  str: string;
  transform: [number, number, number, number, number, number]; // [scaleX, skewY, skewX, scaleY, tx, ty]
  width: number;
  height: number;
}

export interface ReconstructedLine {
  y_top: number;   // Distance from top of page in points
  x0_top: number;  // Leftmost token X in points
  x1_top: number;  // Rightmost token X in points
  text: string;    // Joined line string
  tokens: { str: string; x: number; width: number }[];
}

/**
 * Reconstructs lines from pdfjs-dist TextItems by grouping items with similar Y coordinates.
 */
export function reconstructLinesFromPdfJsItems(
  items: RawPdfTextItem[],
  pageHeightPt: number = 841.89,
  yTolerancePt: number = 2.8
): ReconstructedLine[] {
  const cleaned = items
    .filter(item => item && typeof item.str === 'string' && item.str.trim().length > 0)
    .map(item => {
      const tx = item.transform[4] || 0;
      const ty = item.transform[5] || 0;
      const y_top = Number((pageHeightPt - ty).toFixed(2));
      return {
        str: item.str.trim(),
        x: Number(tx.toFixed(2)),
        y_top,
        width: Number((item.width || 10).toFixed(2)),
      };
    });

  // Sort top-to-bottom first, then left-to-right
  cleaned.sort((a, b) => {
    if (Math.abs(a.y_top - b.y_top) <= yTolerancePt) {
      return a.x - b.x;
    }
    return a.y_top - b.y_top;
  });

  const lines: ReconstructedLine[] = [];
  for (const tok of cleaned) {
    const lastLine = lines[lines.length - 1];
    if (lastLine && Math.abs(lastLine.y_top - tok.y_top) <= yTolerancePt) {
      lastLine.tokens.push({ str: tok.str, x: tok.x, width: tok.width });
      lastLine.x0_top = Math.min(lastLine.x0_top, tok.x);
      lastLine.x1_top = Math.max(lastLine.x1_top, tok.x + tok.width);
    } else {
      lines.push({
        y_top: tok.y_top,
        x0_top: tok.x,
        x1_top: tok.x + tok.width,
        text: '',
        tokens: [{ str: tok.str, x: tok.x, width: tok.width }],
      });
    }
  }

  for (const line of lines) {
    line.tokens.sort((a, b) => a.x - b.x);
    line.text = line.tokens.map(t => t.str).join(' ');
  }

  return lines;
}
