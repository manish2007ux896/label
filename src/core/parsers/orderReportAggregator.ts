// FILE: src/core/parsers/orderReportAggregator.ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { PAPER_PRESETS_PT } from '../pdf/coordinates.ts';
import type { AggregatedPickRow } from '../pdf/renderPicklist4x6.ts';
import { localDb } from '../storage/localDb.ts';

export interface ParsedOrderReportRow {
  orderId: string;
  sku: string;
  size: string;
  color: string;
  qty: number;
  courier?: string;
  status?: string;
  rackCode?: string;
  packerNickname?: string;
}

export interface OrderReportAggregationResult {
  sourceFileName: string;
  totalOrders: number;
  totalUnits: number;
  uniqueSkusCount: number;
  courierCounts: Record<string, number>;
  rows: AggregatedPickRow[];
}

/**
 * Splits CSV lines while respecting quotes.
 */
function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parses a Meesho or Flipkart Order Report Excel CSV/TSV export and aggregates total items to pick.
 */
export async function parseAndAggregateOrderReport(
  content: string,
  fileName: string = 'Order_Report.csv'
): Promise<OrderReportAggregationResult> {
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length < 2) {
    throw new Error('Order report must contain a header and at least 1 order row.');
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headerCols = parseCsvLine(lines[0], delimiter).map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''));

  // Detect column indices dynamically
  let skuIdx = headerCols.findIndex(c => c.includes('sku') || c.includes('productcode') || c.includes('itemcode'));
  let sizeIdx = headerCols.findIndex(c => c.includes('size') || c.includes('variation') || c.includes('variant'));
  let colorIdx = headerCols.findIndex(c => c.includes('color') || c.includes('shade') || c.includes('colour'));
  let qtyIdx = headerCols.findIndex(c => c.includes('qty') || c.includes('quantity') || c.includes('units'));
  let orderIdIdx = headerCols.findIndex(c => c.includes('suborderno') || c.includes('suborder') || c.includes('orderid') || c.includes('orderno'));
  let courierIdx = headerCols.findIndex(c => c.includes('courier') || c.includes('deliverypartner') || c.includes('logistics'));

  // Fallbacks if header names are slightly different
  if (skuIdx === -1) skuIdx = 0; // Default to first column if no match
  if (orderIdIdx === -1) orderIdIdx = 1;

  // Retrieve SKU rack mappings from local database
  const skuMap = new Map<string, { rackCode: string; packerNickname: string }>();
  try {
    const skuDict = await localDb.skuDictionary.toArray();
    for (const item of skuDict) {
      skuMap.set(item.rawSku.trim().toUpperCase(), {
        rackCode: item.rackCode,
        packerNickname: item.packerNickname
      });
    }
  } catch {
    // Non-blocking in node test or if db is empty
  }

  const pickMap = new Map<string, AggregatedPickRow>();
  const courierCounts: Record<string, number> = {};
  let totalOrders = 0;
  let totalUnits = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    if (cols.length <= skuIdx) continue;

    const rawSku = (cols[skuIdx] || '').replace(/^["']|["']$/g, '').trim().toUpperCase();
    if (!rawSku) continue;

    let size = sizeIdx !== -1 && cols[sizeIdx] ? cols[sizeIdx].replace(/^["']|["']$/g, '').trim().toUpperCase() : 'FREE';
    if (!size || size === '-') size = 'FREE';

    let color = colorIdx !== -1 && cols[colorIdx] ? cols[colorIdx].replace(/^["']|["']$/g, '').trim().toUpperCase() : 'STD';
    if (!color || color === '-') color = 'STD';

    let qty = 1;
    if (qtyIdx !== -1 && cols[qtyIdx]) {
      const parsedQty = parseInt(cols[qtyIdx].replace(/[^\d]/g, ''), 10);
      if (!isNaN(parsedQty) && parsedQty > 0) qty = parsedQty;
    }

    const courier = courierIdx !== -1 && cols[courierIdx]
      ? cols[courierIdx].replace(/^["']|["']$/g, '').trim().toUpperCase()
      : 'ALL_ORDERS';

    courierCounts[courier] = (courierCounts[courier] || 0) + 1;
    totalOrders += 1;
    totalUnits += qty;

    const mapping = skuMap.get(rawSku);
    const rackCode = mapping ? mapping.rackCode : '-';
    const nickname = mapping ? mapping.packerNickname : '';

    const groupKey = `${rackCode}__${rawSku}__${size}__${color}`;
    const existing = pickMap.get(groupKey);
    if (existing) {
      existing.totalPackets += 1;
      existing.totalUnits += qty;
      if (qty > 1) existing.multiQtyPackets += 1;
    } else {
      pickMap.set(groupKey, {
        rackCode,
        sku: rawSku,
        nickname,
        size,
        color,
        totalPackets: 1,
        totalUnits: qty,
        multiQtyPackets: qty > 1 ? 1 : 0
      });
    }
  }

  const rows = Array.from(pickMap.values()).sort((a, b) => {
    // Sort by Rack first, then SKU, then Size
    const rCmp = a.rackCode.localeCompare(b.rackCode, undefined, { numeric: true });
    if (rCmp !== 0) return rCmp;
    const sCmp = a.sku.localeCompare(b.sku, undefined, { numeric: true });
    if (sCmp !== 0) return sCmp;
    return b.totalUnits - a.totalUnits;
  });

  const uniqueSkus = new Set(rows.map(r => r.sku));

  return {
    sourceFileName: fileName,
    totalOrders,
    totalUnits,
    uniqueSkusCount: uniqueSkus.size,
    courierCounts,
    rows
  };
}

/**
 * Generates a ready-to-print 4×6 Thermal Picklist Sticker PDF from aggregated rows.
 */
export async function renderStandaloneThermalPicklistPdf(
  summary: OrderReportAggregationResult,
  batchTitle: string = 'EXCEL PICKLIST'
): Promise<Uint8Array> {
  const outPdf = await PDFDocument.create();
  const boldFont = await outPdf.embedFont(StandardFonts.HelveticaBold);
  const regFont  = await outPdf.embedFont(StandardFonts.Helvetica);

  const { rows, courierCounts, totalOrders, totalUnits, uniqueSkusCount } = summary;
  const ROWS_PER_STICKER = 15;
  const totalStickers = Math.max(1, Math.ceil(rows.length / ROWS_PER_STICKER));
  const nowStr = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  });

  for (let sIdx = 0; sIdx < totalStickers; sIdx++) {
    const page = outPdf.addPage([PAPER_PRESETS_PT.THERMAL_4X6.width, PAPER_PRESETS_PT.THERMAL_4X6.height]);
    const chunk = rows.slice(sIdx * ROWS_PER_STICKER, (sIdx + 1) * ROWS_PER_STICKER);

    // Top Header Banner (Black)
    page.drawRectangle({ x: 8, y: 396, width: 272, height: 28, color: rgb(0, 0, 0) });
    page.drawText(`${batchTitle} (${sIdx + 1}/${totalStickers})`, {
      x: 14, y: 411, size: 9.5, font: boldFont, color: rgb(1, 1, 1)
    });
    page.drawText(`${nowStr} | Orders: ${totalOrders} | SKUs: ${uniqueSkusCount} | Units: ${totalUnits}`, {
      x: 14, y: 400, size: 7.5, font: regFont, color: rgb(0.9, 0.9, 0.9)
    });

    // Summary Subheader Bar
    const courierSummary = Object.entries(courierCounts)
      .map(([c, cnt]) => `${c}: ${cnt}`)
      .join('  |  ');
    page.drawRectangle({
      x: 8, y: 374, width: 272, height: 20,
      borderColor: rgb(0, 0, 0), borderWidth: 1.0, color: rgb(0.95, 0.95, 0.95)
    });
    page.drawText(`SUMMARY: ${courierSummary.slice(0, 48)}`, {
      x: 12, y: 381, size: 7.5, font: boldFont, color: rgb(0, 0, 0)
    });

    // Column Headers
    page.drawRectangle({ x: 8, y: 356, width: 272, height: 16, color: rgb(0.15, 0.15, 0.15) });
    page.drawText('RACK', { x: 12, y: 361, size: 7.5, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText('SKU / ITEM NICKNAME', { x: 55, y: 361, size: 7.5, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText('SIZE', { x: 185, y: 361, size: 7.5, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText('UNITS', { x: 235, y: 361, size: 7.5, font: boldFont, color: rgb(1, 1, 1) });

    // Table rows
    let y = 338;
    for (let r = 0; r < chunk.length; r++) {
      const item = chunk[r];
      const isAlt = r % 2 === 1;

      if (isAlt) {
        page.drawRectangle({ x: 8, y: y - 3, width: 272, height: 19, color: rgb(0.97, 0.97, 0.97) });
      }

      // Checkbox square for physical warehouse tick-off
      page.drawRectangle({
        x: 12, y: y + 1, width: 8, height: 8,
        borderColor: rgb(0, 0, 0), borderWidth: 0.8, color: rgb(1, 1, 1)
      });

      // Rack
      page.drawText(item.rackCode.slice(0, 7), {
        x: 23, y: y + 2, size: 7.5, font: boldFont, color: rgb(0, 0, 0)
      });

      // SKU + Nickname
      const skuLabel = item.nickname
        ? `${item.sku} (${item.nickname})`.slice(0, 24)
        : item.sku.slice(0, 24);
      page.drawText(skuLabel, {
        x: 55, y: y + 2, size: 7.5, font: boldFont, color: rgb(0, 0, 0)
      });

      // Size & Color
      const sizeColorStr = `${item.size}${item.color && item.color !== 'STD' ? '/' + item.color : ''}`.slice(0, 8);
      page.drawText(sizeColorStr, {
        x: 185, y: y + 2, size: 7.5, font: boldFont, color: rgb(0, 0, 0)
      });

      // Units Count (Enlarged)
      page.drawText(`${item.totalUnits}`, {
        x: 242, y: y + 1, size: 9.0, font: boldFont, color: rgb(0, 0, 0)
      });

      y -= 21;
    }

    // Bottom Footer note
    page.drawText('SmartLabelCrop.in - 100% Client-Side WebAssembly Warehouse Tools', {
      x: 12, y: 8, size: 6.5, font: regFont, color: rgb(0.4, 0.4, 0.4)
    });
  }

  return await outPdf.save();
}

/**
 * Generates an A4 Printable Warehouse Picking Sheet (595.28 x 841.89 pt).
 */
export async function renderA4WarehousePullSheetPdf(
  summary: OrderReportAggregationResult,
  batchTitle: string = 'WAREHOUSE PICKING MANIFEST'
): Promise<Uint8Array> {
  const outPdf = await PDFDocument.create();
  const boldFont = await outPdf.embedFont(StandardFonts.HelveticaBold);
  const regFont  = await outPdf.embedFont(StandardFonts.Helvetica);

  const { rows, courierCounts, totalOrders, totalUnits, uniqueSkusCount } = summary;
  const ROWS_PER_PAGE = 30;
  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const nowStr = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  });

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;

  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const page = outPdf.addPage([PAGE_W, PAGE_H]);
    const chunk = rows.slice(pIdx * ROWS_PER_PAGE, (pIdx + 1) * ROWS_PER_PAGE);

    // Top Header Banner
    page.drawRectangle({ x: 28, y: PAGE_H - 65, width: PAGE_W - 56, height: 40, color: rgb(0.08, 0.08, 0.08) });
    page.drawText(`${batchTitle} (Page ${pIdx + 1} of ${totalPages})`, {
      x: 40, y: PAGE_H - 45, size: 14.0, font: boldFont, color: rgb(1, 1, 1)
    });
    page.drawText(`Date: ${nowStr}  |  Total Orders: ${totalOrders}  |  Unique SKUs: ${uniqueSkusCount}  |  Total Pull Units: ${totalUnits}`, {
      x: 40, y: PAGE_H - 58, size: 8.5, font: regFont, color: rgb(0.85, 0.85, 0.85)
    });

    // Summary sub-bar
    const courierSummary = Object.entries(courierCounts)
      .map(([c, cnt]) => `${c}: ${cnt}`)
      .join('   |   ');
    page.drawRectangle({
      x: 28, y: PAGE_H - 95, width: PAGE_W - 56, height: 22,
      borderColor: rgb(0, 0, 0), borderWidth: 1.0, color: rgb(0.95, 0.95, 0.95)
    });
    page.drawText(`LOGISTICS BREAKDOWN: ${courierSummary.slice(0, 85)}`, {
      x: 36, y: PAGE_H - 86, size: 8.5, font: boldFont, color: rgb(0, 0, 0)
    });

    // Column Headers
    page.drawRectangle({ x: 28, y: PAGE_H - 120, width: PAGE_W - 56, height: 20, color: rgb(0.2, 0.2, 0.2) });
    page.drawText('PICK', { x: 36, y: PAGE_H - 113, size: 8.5, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText('RACK / BIN', { x: 75, y: PAGE_H - 113, size: 8.5, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText('MARKETPLACE SKU & PRODUCT NICKNAME', { x: 155, y: PAGE_H - 113, size: 8.5, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText('SIZE', { x: 390, y: PAGE_H - 113, size: 8.5, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText('COLOR', { x: 450, y: PAGE_H - 113, size: 8.5, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText('TOTAL UNITS', { x: 505, y: PAGE_H - 113, size: 8.5, font: boldFont, color: rgb(1, 1, 1) });

    // Table rows
    let y = PAGE_H - 142;
    for (let r = 0; r < chunk.length; r++) {
      const item = chunk[r];
      const isAlt = r % 2 === 1;

      if (isAlt) {
        page.drawRectangle({ x: 28, y: y - 4, width: PAGE_W - 56, height: 18, color: rgb(0.97, 0.97, 0.97) });
      }

      // Checkbox
      page.drawRectangle({
        x: 36, y: y, width: 10, height: 10,
        borderColor: rgb(0, 0, 0), borderWidth: 1.0, color: rgb(1, 1, 1)
      });

      // Rack
      page.drawText(item.rackCode || '-', {
        x: 75, y: y + 1, size: 8.5, font: boldFont, color: rgb(0, 0, 0)
      });

      // SKU + Nickname
      const skuLabel = item.nickname
        ? `${item.sku} (${item.nickname})`.slice(0, 38)
        : item.sku.slice(0, 38);
      page.drawText(skuLabel, {
        x: 155, y: y + 1, size: 8.5, font: boldFont, color: rgb(0, 0, 0)
      });

      // Size
      page.drawText(item.size || 'FREE', {
        x: 390, y: y + 1, size: 8.5, font: boldFont, color: rgb(0, 0, 0)
      });

      // Color
      page.drawText(item.color || '-', {
        x: 450, y: y + 1, size: 8.5, font: regFont, color: rgb(0, 0, 0)
      });

      // Units Count
      page.drawText(`${item.totalUnits}`, {
        x: 520, y: y + 1, size: 9.5, font: boldFont, color: rgb(0, 0, 0)
      });

      y -= 20;
    }

    // Footer
    page.drawText(`SmartLabelCrop.in | Page ${pIdx + 1} of ${totalPages} | Generated in Browser via WebAssembly`, {
      x: 28, y: 22, size: 7.5, font: regFont, color: rgb(0.4, 0.4, 0.4)
    });
  }

  return await outPdf.save();
}
