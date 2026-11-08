// FILE: src/core/pdf/sortLabels.ts
import type { ParsedLabelPage } from '../../types/label.ts';
import type { SortMode } from '../../types/marketplace.ts';

const APPAREL_SIZE_RANK: Record<string, number> = {
  'XXS': 1, 'XS': 2, 'S': 3, 'SMALL': 3,
  'M': 4, 'MEDIUM': 4, 'L': 5, 'LARGE': 5,
  'XL': 6, 'XXL': 7, '2XL': 7, '3XL': 8,
  '4XL': 9, '5XL': 10, '6XL': 11, 'FREE SIZE': 12, 'FREE': 12
};

export function getSizeRank(sizeStr: string): number {
  const norm = (sizeStr || '').trim().toUpperCase();
  if (APPAREL_SIZE_RANK[norm] !== undefined) return APPAREL_SIZE_RANK[norm];
  const num = parseFloat(norm);
  if (!isNaN(num)) return 100 + num; // Numeric waist/shoe sizes like 28, 30, 32, 34
  return 999;
}

export function sortParsedLabels(labels: ParsedLabelPage[], mode: SortMode = 'COURIER_SKU_SIZE_QTY'): ParsedLabelPage[] {
  return [...labels].sort((a, b) => {
    if (mode === 'COURIER_SKU_SIZE_QTY') {
      // 1. Group by Courier Partner (Valmo, Delhivery, Shadowfax, Xpressbees, Ekart)
      const cCmp = a.courier.localeCompare(b.courier);
      if (cCmp !== 0) return cCmp;
    }

    if (mode === 'RACK_SKU_SIZE') {
      // 1. Group by Warehouse Rack Code (e.g. A-01, A-02, B-01)
      const rCmp = (a.rackCode || 'ZZZ').localeCompare(b.rackCode || 'ZZZ', undefined, { numeric: true });
      if (rCmp !== 0) return rCmp;
    }

    // 2. Group by SKU Code
    const sCmp = a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: 'base' });
    if (sCmp !== 0) return sCmp;

    // 3. Group by Apparel Size Rank or Color
    if (mode === 'COLOR_WITH_SIZE') {
      const colCmp = a.color.localeCompare(b.color);
      if (colCmp !== 0) return colCmp;
      return getSizeRank(a.size) - getSizeRank(b.size);
    }

    const szCmp = getSizeRank(a.size) - getSizeRank(b.size);
    if (szCmp !== 0) return szCmp;

    // 4. Put Single-Qty orders first, then Multi-Qty orders grouped together
    return a.totalQty - b.totalQty;
  });
}
