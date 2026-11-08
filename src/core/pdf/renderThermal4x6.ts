// FILE: src/core/pdf/renderThermal4x6.ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { ParsedLabelPage } from '../../types/label.ts';
import { toPdfLibCropBox, PAPER_PRESETS_PT } from './coordinates.ts';

export interface RenderThermalOptions {
  stampSku: boolean;
  customNote?: string;
  storeName?: string;
}

export function sanitizeForStandardFont(text: string): string {
  if (!text) return '';
  return text
    .replace(/[★☆✦✧]/g, '*')
    .replace(/[•●]/g, '-')
    .replace(/[₹]/g, 'Rs. ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

export async function renderThermal4x6Document(
  sortedLabels: ParsedLabelPage[],
  sourcePdfBuffers: Map<string, Uint8Array>,
  options: RenderThermalOptions = { stampSku: true }
): Promise<Uint8Array> {
  const outPdf = await PDFDocument.create();
  const boldFont = await outPdf.embedFont(StandardFonts.HelveticaBold);
  const regFont  = await outPdf.embedFont(StandardFonts.Helvetica);

  const loadedSources = new Map<string, PDFDocument>();
  for (const [fileId, buf] of sourcePdfBuffers.entries()) {
    loadedSources.set(fileId, await PDFDocument.load(buf, { ignoreEncryption: true }));
  }

  const totalCount = sortedLabels.length;
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  for (let idx = 0; idx < totalCount; idx++) {
    const item = sortedLabels[idx];
    const srcDoc = loadedSources.get(item.sourceFileId);
    if (!srcDoc) continue;

    const srcPage = srcDoc.getPage(item.sourceLabelPageIndex);
    const { height: srcHeight } = srcPage.getSize();

    // 1. Convert top-down crop box to pdf-lib bottom-left bounding box
    const bbox = toPdfLibCropBox(
      item.cropBoxTopDown.x0,
      item.cropBoxTopDown.y0,
      item.cropBoxTopDown.x1,
      item.cropBoxTopDown.y1,
      srcHeight
    );

    // 2. Embed vector page region without rasterization (RULE-02)
    const embeddedLabel = await outPdf.embedPage(srcPage, {
      left:   bbox.x,
      bottom: bbox.y,
      right:  bbox.x + bbox.width,
      top:    bbox.y + bbox.height,
    });

    // 3. Create 4x6 inch (288pt x 432pt) thermal sticker page
    const page = outPdf.addPage([PAPER_PRESETS_PT.THERMAL_4X6.width, PAPER_PRESETS_PT.THERMAL_4X6.height]);

    // 4. Reserve bottom 74pt (y: 4..76pt) for Stamped Packing Footer; fit label in top 348pt (y: 78..426pt)
    const targetW = 276.0;
    const targetH = options.stampSku ? 348.0 : 416.0;
    const scale   = Math.min(targetW / bbox.width, targetH / bbox.height);
    const drawW   = bbox.width * scale;
    const drawH   = bbox.height * scale;
    const drawX   = (288.0 - drawW) / 2.0;
    const drawY   = options.stampSku ? 78.0 + (targetH - drawH) / 2.0 : 8.0 + (targetH - drawH) / 2.0;

    page.drawPage(embeddedLabel, { x: drawX, y: drawY, width: drawW, height: drawH });

    // 5. Render High-Contrast Packing Footer & Multi-Order Alert Box
    if (options.stampSku) {
      // Outer footer border box
      page.drawRectangle({
        x: 6,
        y: 4,
        width: 276,
        height: 70,
        borderColor: rgb(0, 0, 0),
        borderWidth: item.totalQty > 1 ? 2.0 : 1.0,
        color: rgb(1, 1, 1)
      });

      if (item.totalQty > 1) {
        // SOLID BLACK INVERTED ALERT BANNER FOR MULTI-QUANTITY ORDERS (RULE-08)
        page.drawRectangle({
          x: 6,
          y: 56,
          width: 276,
          height: 18,
          color: rgb(0, 0, 0)
        });

        page.drawText(`*** MULTI-ORDER: PACK ${item.totalQty} PCS (CHECK QTY!) ***`, {
          x: 14,
          y: 61,
          size: 9.0,
          font: boldFont,
          color: rgb(1, 1, 1)
        });
      }

      const displaySku = item.packerNickname
        ? `${item.sku} (${item.packerNickname})`.slice(0, 38)
        : item.sku.slice(0, 38);

      page.drawText(`SKU: ${displaySku}`, {
        x: 10,
        y: item.totalQty > 1 ? 41 : 54,
        size: item.totalQty > 1 ? 9.5 : 10.5,
        font: boldFont,
        color: rgb(0, 0, 0)
      });

      if (item.rackCode && item.rackCode !== 'UNASSIGNED') {
        page.drawText(`RACK: ${item.rackCode}`, {
          x: 205,
          y: item.totalQty > 1 ? 41 : 54,
          size: 9.5,
          font: boldFont,
          color: rgb(0, 0, 0)
        });
      }

      page.drawText(
        `SIZE: ${item.size || 'FREE'}   |   COLOR: ${item.color || 'STD'}   |   QTY: ${item.totalQty} PC${item.totalQty > 1 ? 'S' : ''}`,
        {
          x: 10,
          y: 23,
          size: 10.0,
          font: boldFont,
          color: rgb(0, 0, 0)
        }
      );

      const noteText = sanitizeForStandardFont(options.customNote || '360 Unboxing Video Mandatory');
      const metaLine = sanitizeForStandardFont(`#${String(idx + 1).padStart(3, '0')}/${totalCount} | ${item.courier} | ${dateStr} | ${noteText.slice(0, 28)}`);
      
      page.drawText(metaLine, {
        x: 10,
        y: 8,
        size: 7.5,
        font: regFont,
        color: rgb(0.2, 0.2, 0.2)
      });
    }
  }

  return await outPdf.save();
}
