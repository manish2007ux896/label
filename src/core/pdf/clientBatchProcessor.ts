// FILE: src/core/pdf/clientBatchProcessor.ts
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import type { ParsedLabelPage } from '../../types/label.ts';
import type { SortMode, OutputMode } from '../../types/marketplace.ts';
import { reconstructLinesFromPdfJsItems, type RawPdfTextItem } from './textReconstructor.ts';
import { parseMeeshoPage } from './parsers/meeshoParser.ts';
import { parseFlipkartOrShopsyPage } from './parsers/flipkartParser.ts';
import { parseAmazonEasyShipPage, parseGlowroadPage } from './parsers/amazonAndGlowroadParser.ts';
import { sortParsedLabels } from './sortLabels.ts';
import { renderThermal4x6Document } from './renderThermal4x6.ts';
import { prependThermalPicklistPages } from './renderPicklist4x6.ts';
import { checkDuplicateAwbsLocal, recordPrintedAwbsLocal, type DuplicateDetectionResult } from '../storage/awbDeduplicator.ts';
import { localDb } from '../storage/localDb.ts';

// Configure local worker path for offline resilience
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export interface ProcessBatchInput {
  files: {
    id: string;
    name: string;
    buffer: ArrayBuffer;
  }[];
  options: {
    outputMode: OutputMode;
    sortMode: SortMode;
    stampSku: boolean;
    includePicklistSticker: boolean;
    skipDuplicates: boolean;
    customNote: string;
    excludedSkus?: Set<string>;
    excludedCouriers?: Set<string>;
  };
  onProgress?: (stage: string, progressPct: number) => void;
}

export interface ProcessBatchResult {
  outputPdfBytes: Uint8Array;
  parsedLabels: ParsedLabelPage[];
  activeLabels: ParsedLabelPage[];
  totalLabels: number;
  multiQtyCount: number;
  duplicateInfo: DuplicateDetectionResult;
  courierCounts: Record<string, number>;
  batchCode: string;
}

export async function processSellerBatch(input: ProcessBatchInput): Promise<ProcessBatchResult> {
  const { files, options, onProgress } = input;
  const sourceBuffers = new Map<string, Uint8Array>();
  const parsedLabels: ParsedLabelPage[] = [];
  const batchCode = `B-${Date.now().toString().slice(-4)}`;

  onProgress?.('Extracting text & barcode coordinates...', 10);

  // 1. Parse all pages across all uploaded PDF files
  for (let fIdx = 0; fIdx < files.length; fIdx++) {
    const file = files[fIdx];
    const rawBytes = new Uint8Array(file.buffer);
    // Keep an independent buffer copy for pdf-lib vector embedding (prevents worker buffer neutering)
    sourceBuffers.set(file.id, new Uint8Array(rawBytes.slice(0)));

    // Pass a separate copy to pdfjsLib
    const pdfJsData = new Uint8Array(rawBytes.slice(0));
    const loadingTask = pdfjsLib.getDocument({ data: pdfJsData });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    for (let p = 1; p <= numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();
      const lines = reconstructLinesFromPdfJsItems(textContent.items as RawPdfTextItem[], viewport.height);

      const pageText = lines.map(l => l.text).join('\n');
      
      let parsed: ParsedLabelPage;
      if (/\b(Flipkart|E-?Kart|OD\d{15,})\b/i.test(pageText)) {
        parsed = parseFlipkartOrShopsyPage(lines, file.id, p - 1, viewport.width, viewport.height);
      } else if (/\b(Amazon|ATS|Easy\s*Ship|\d{3}-\d{7}-\d{7})\b/i.test(pageText)) {
        parsed = parseAmazonEasyShipPage(lines, file.id, p - 1, viewport.width, viewport.height);
      } else if (/\b(GlowRoad|GLW\d{6,})\b/i.test(pageText)) {
        parsed = parseGlowroadPage(lines, file.id, p - 1, viewport.width, viewport.height);
      } else {
        parsed = parseMeeshoPage(lines, file.id, p - 1, viewport.width, viewport.height);
      }

      parsedLabels.push(parsed);

      const progress = 10 + Math.round(((fIdx * numPages + p) / (files.length * numPages)) * 40);
      onProgress?.(`Parsing page ${p} of ${numPages} (${file.name})...`, progress);
    }

    try {
      if (typeof (pdfDoc as any).cleanup === 'function') {
        (pdfDoc as any).cleanup();
      }
      if (typeof (loadingTask as any).destroy === 'function') {
        await (loadingTask as any).destroy();
      }
    } catch {
      // Ignore cleanup error
    }
  }

  onProgress?.('Checking 30-day duplicate AWB history...', 55);

  // 2. Check for duplicate AWBs printed earlier
  const awbs = parsedLabels.map(l => l.awbNumber);
  const duplicateInfo = await checkDuplicateAwbsLocal(awbs);

  const duplicateSet = new Set(duplicateInfo.duplicateAwbs);
  for (const l of parsedLabels) {
    if (duplicateSet.has(l.awbNumber)) {
      l.isDuplicate = true;
    }
  }

  // 3. Enrich labels with Warehouse Rack & Bin locations from local SKU dictionary (if available)
  try {
    const skuDict = await localDb.skuDictionary.toArray();
    if (skuDict && skuDict.length > 0) {
      const skuMap = new Map<string, { rackCode: string; packerNickname: string }>();
      for (const entry of skuDict) {
        skuMap.set(entry.rawSku.trim().toUpperCase(), {
          rackCode: entry.rackCode,
          packerNickname: entry.packerNickname
        });
      }

      for (const l of parsedLabels) {
        const cleanSku = (l.sku || '').trim().toUpperCase();
        const match = skuMap.get(cleanSku);
        if (match) {
          if (!l.rackCode || l.rackCode === 'UNASSIGNED') {
            l.rackCode = match.rackCode;
          }
          if (!l.packerNickname) {
            l.packerNickname = match.packerNickname;
          }
        }
      }
    }
  } catch (err) {
    // Non-blocking in environments without IndexedDB (e.g. Node tests)
  }

  // 4. Filter excluded SKUs, couriers, or duplicates
  let activeLabels = parsedLabels.filter(l => {
    if (options.skipDuplicates && l.isDuplicate) return false;
    if (options.excludedSkus && options.excludedSkus.has(l.sku)) return false;
    if (options.excludedCouriers && options.excludedCouriers.has(l.courier)) return false;
    return true;
  });

  onProgress?.('Sorting labels by Courier, SKU & Apparel Size...', 70);

  // 4. Sort labels deterministically
  activeLabels = sortParsedLabels(activeLabels, options.sortMode);

  onProgress?.('Generating 100% vector 4x6 thermal PDF...', 85);

  // 5. Render 4x6 Vector PDF
  const thermalBytes = await renderThermal4x6Document(activeLabels, sourceBuffers, {
    stampSku: options.stampSku,
    customNote: options.customNote
  });

  let finalPdfBytes = thermalBytes;

  // 6. Prepend Page-1 Thermal Picklist Sticker if requested
  if (options.includePicklistSticker && activeLabels.length > 0) {
    onProgress?.('Adding Page-1 Thermal Picklist Sticker...', 92);
    const docWithPicklist = await PDFDocument.load(thermalBytes);
    await prependThermalPicklistPages(docWithPicklist, activeLabels, batchCode);
    finalPdfBytes = await docWithPicklist.save();
  }

  // 7. Calculate aggregate summary counts
  const courierCounts: Record<string, number> = {};
  let multiQtyCount = 0;

  for (const l of activeLabels) {
    courierCounts[l.courier] = (courierCounts[l.courier] || 0) + 1;
    if (l.totalQty > 1) multiQtyCount++;
  }

  onProgress?.('Ready to print!', 100);

  return {
    outputPdfBytes: finalPdfBytes,
    parsedLabels,
    activeLabels,
    totalLabels: activeLabels.length,
    multiQtyCount,
    duplicateInfo,
    courierCounts,
    batchCode
  };
}
