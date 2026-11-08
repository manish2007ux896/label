// FILE: src/core/pdf/renderPicklist4x6.ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { ParsedLabelPage } from '../../types/label.ts';
import { PAPER_PRESETS_PT } from './coordinates.ts';

export interface AggregatedPickRow {
  rackCode: string;
  sku: string;
  nickname: string;
  size: string;
  color: string;
  totalPackets: number;
  totalUnits: number;
  multiQtyPackets: number;
}

export function aggregatePicklistRows(labels: ParsedLabelPage[]): {
  courierCounts: Record<string, number>;
  rows: AggregatedPickRow[];
  totalPackets: number;
  totalUnits: number;
} {
  const courierCounts: Record<string, number> = {};
  const map = new Map<string, AggregatedPickRow>();
  let totalUnits = 0;

  for (const lbl of labels) {
    courierCounts[lbl.courier] = (courierCounts[lbl.courier] || 0) + 1;
    totalUnits += lbl.totalQty;

    const key = `${lbl.rackCode || 'ZZZ'}__${lbl.sku}__${lbl.size}__${lbl.color}`;
    const existing = map.get(key);
    if (existing) {
      existing.totalPackets += 1;
      existing.totalUnits += lbl.totalQty;
      if (lbl.totalQty > 1) existing.multiQtyPackets += 1;
    } else {
      map.set(key, {
        rackCode: lbl.rackCode || '-',
        sku: lbl.sku,
        nickname: lbl.packerNickname || '',
        size: lbl.size || 'FREE',
        color: lbl.color || '-',
        totalPackets: 1,
        totalUnits: lbl.totalQty,
        multiQtyPackets: lbl.totalQty > 1 ? 1 : 0,
      });
    }
  }

  const rows = Array.from(map.values()).sort((a, b) => {
    const rCmp = a.rackCode.localeCompare(b.rackCode, undefined, { numeric: true });
    if (rCmp !== 0) return rCmp;
    const sCmp = a.sku.localeCompare(b.sku, undefined, { numeric: true });
    if (sCmp !== 0) return sCmp;
    return b.totalUnits - a.totalUnits;
  });

  return { courierCounts, rows, totalPackets: labels.length, totalUnits };
}

export async function prependThermalPicklistPages(
  outPdf: PDFDocument,
  labels: ParsedLabelPage[],
  batchCode: string = 'BATCH-01'
): Promise<number> {
  const boldFont = await outPdf.embedFont(StandardFonts.HelveticaBold);
  const regFont  = await outPdf.embedFont(StandardFonts.Helvetica);

  const { courierCounts, rows, totalPackets, totalUnits } = aggregatePicklistRows(labels);
  const ROWS_PER_STICKER = 16;
  const totalStickers = Math.max(1, Math.ceil(rows.length / ROWS_PER_STICKER));
  const nowStr = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  for (let sIdx = 0; sIdx < totalStickers; sIdx++) {
    const page = outPdf.insertPage(sIdx, [PAPER_PRESETS_PT.THERMAL_4X6.width, PAPER_PRESETS_PT.THERMAL_4X6.height]);
    const chunk = rows.slice(sIdx * ROWS_PER_STICKER, (sIdx + 1) * ROWS_PER_STICKER);

    // Top Header Banner (Black fill with white text)
    page.drawRectangle({ x: 8, y: 396, width: 272, height: 28, color: rgb(0, 0, 0) });
    page.drawText(`WAREHOUSE PICKLIST (${sIdx + 1}/${totalStickers}) - ${batchCode}`, {
      x: 14, y: 411, size: 9.5, font: boldFont, color: rgb(1, 1, 1)
    });
    page.drawText(`${nowStr} | Packets: ${totalPackets} | Total Units: ${totalUnits}`, {
      x: 14, y: 400, size: 7.8, font: regFont, color: rgb(0.9, 0.9, 0.9)
    });

    // Courier Handover Summary Bar
    const courierSummary = Object.entries(courierCounts)
      .map(([c, cnt]) => `${c}: ${cnt}`)
      .join('  |  ');
    page.drawRectangle({
      x: 8, y: 372, width: 272, height: 22,
      borderColor: rgb(0, 0, 0), borderWidth: 1.0, color: rgb(0.96, 0.96, 0.96)
    });
    page.drawText(`COURIERS: ${courierSummary.slice(0, 52)}`, {
      x: 12, y: 380, size: 8.0, font: boldFont, color: rgb(0, 0, 0)
    });

    // Table Column Headers
    let curY = 354;
    page.drawText('RACK', { x: 10, y: curY, size: 7.8, font: boldFont });
    page.drawText('SKU / ITEM NICKNAME', { x: 44, y: curY, size: 7.8, font: boldFont });
    page.drawText('SIZE', { x: 196, y: curY, size: 7.8, font: boldFont });
    page.drawText('PKTS', { x: 228, y: curY, size: 7.8, font: boldFont });
    page.drawText('PCS',  { x: 256, y: curY, size: 7.8, font: boldFont });
    page.drawLine({ start: { x: 8, y: curY - 4 }, end: { x: 280, y: curY - 4 }, thickness: 1.2 });

    curY -= 18;
    for (const r of chunk) {
      const labelStr = r.nickname ? `${r.sku} (${r.nickname})` : r.sku;
      page.drawText(r.rackCode.slice(0, 6), { x: 10, y: curY, size: 8.0, font: boldFont });
      page.drawText(labelStr.slice(0, 26),  { x: 44, y: curY, size: 8.0, font: regFont });
      page.drawText(r.size.slice(0, 5),     { x: 196, y: curY, size: 8.0, font: boldFont });
      page.drawText(String(r.totalPackets), { x: 232, y: curY, size: 8.0, font: regFont });
      page.drawText(String(r.totalUnits),   { x: 258, y: curY, size: 8.5, font: boldFont });
      page.drawLine({ start: { x: 8, y: curY - 4 }, end: { x: 280, y: curY - 4 }, thickness: 0.4, color: rgb(0.7, 0.7, 0.7) });
      curY -= 20;
    }
  }

  return totalStickers;
}
