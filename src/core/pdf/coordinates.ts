// FILE: src/core/pdf/coordinates.ts

export const PT_PER_INCH = 72.0;
export const PT_PER_MM   = 72.0 / 25.4; // ~2.83464567 pt/mm

export const PAPER_PRESETS_PT = {
  A4_PORTRAIT:  { width: 595.28, height: 841.89, name: 'A4 (210mm x 297mm)' },
  THERMAL_4X6:  { width: 288.00, height: 432.00, name: '4x6 inch Thermal Roll (101.6mm x 152.4mm)' },
  THERMAL_4X4:  { width: 288.00, height: 288.00, name: '4x4 inch Thermal Roll (101.6mm x 101.6mm)' },
  THERMAL_3X5:  { width: 216.00, height: 360.00, name: '3x5 inch Thermal Roll (76.2mm x 127.0mm)' },
} as const;

export interface PdfLibBottomLeftBox {
  x: number;      // Distance from left edge of page in points
  y: number;      // Distance from BOTTOM edge of page to bottom of box in points
  width: number;  // Box width in points
  height: number; // Box height in points
  left: number;   // Bounding box left for embedPage()
  bottom: number; // Bounding box bottom for embedPage()
  right: number;  // Bounding box right for embedPage()
  top: number;    // Bounding box top for embedPage()
}

/**
 * Converts top-down coordinates (x0, y0, x1, y1 from top-left)
 * to bottom-left Cartesian coordinates expected by pdf-lib.
 */
export function toPdfLibCropBox(
  x0_top: number,
  y0_top: number,
  x1_top: number,
  y1_top: number,
  sourcePageHeightPt: number = PAPER_PRESETS_PT.A4_PORTRAIT.height
): PdfLibBottomLeftBox {
  const clampedX0 = Math.max(0, Math.min(x0_top, x1_top - 10));
  const clampedY0 = Math.max(0, Math.min(y0_top, y1_top - 10));
  const clampedX1 = Math.max(clampedX0 + 10, x1_top);
  const clampedY1 = Math.min(sourcePageHeightPt, Math.max(clampedY0 + 10, y1_top));

  const width  = Number((clampedX1 - clampedX0).toFixed(2));
  const height = Number((clampedY1 - clampedY0).toFixed(2));
  const x      = Number(clampedX0.toFixed(2));
  const y      = Number((sourcePageHeightPt - clampedY1).toFixed(2));

  return {
    x,
    y,
    width,
    height,
    left:   x,
    bottom: y,
    right:  Number((x + width).toFixed(2)),
    top:    Number((y + height).toFixed(2)),
  };
}

/**
 * Computes the exact 4 quadrants on an A4 sheet (595.28pt x 841.89pt)
 * for 4-in-1 A4 Sticker Grid printing (ST-4 label sheet).
 * Quadrant indices: 0 = Top-Left, 1 = Top-Right, 2 = Bottom-Left, 3 = Bottom-Right.
 */
export function getA4FourUpQuadrantBox(quadrantIndex: 0 | 1 | 2 | 3): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const marginX = 10.0;
  const marginY = 10.0;
  const gapX    = 11.28;
  const gapY    = 9.89;
  const cellW   = (PAPER_PRESETS_PT.A4_PORTRAIT.width - 2 * marginX - gapX) / 2.0;  // 282.0 pt
  const cellH   = (PAPER_PRESETS_PT.A4_PORTRAIT.height - 2 * marginY - gapY) / 2.0; // 406.0 pt

  switch (quadrantIndex) {
    case 0: // Top-Left Quadrant
      return { x: marginX, y: marginY + cellH + gapY, width: cellW, height: cellH };
    case 1: // Top-Right Quadrant
      return { x: marginX + cellW + gapX, y: marginY + cellH + gapY, width: cellW, height: cellH };
    case 2: // Bottom-Left Quadrant
      return { x: marginX, y: marginY, width: cellW, height: cellH };
    case 3: // Bottom-Right Quadrant
      return { x: marginX + cellW + gapX, y: marginY, width: cellW, height: cellH };
  }
}
