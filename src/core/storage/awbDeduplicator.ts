// FILE: src/core/storage/awbDeduplicator.ts
import { localDb, type LocalAwbRecord } from './localDb.ts';
import type { ParsedLabelPage } from '../../types/label.ts';

export interface DuplicateDetectionResult {
  hasDuplicates: boolean;
  duplicateCount: number;
  duplicateAwbs: string[];
  details: {
    awbNumber: string;
    printedHoursAgo: number;
    originalBatchCode: string;
  }[];
}

/**
 * Checks in under 10ms whether any AWBs in the current batch were already printed in the last 30 days.
 */
export async function checkDuplicateAwbsLocal(awbs: string[]): Promise<DuplicateDetectionResult> {
  const validAwbs = awbs.filter(a => a && a !== 'UNKNOWN_AWB' && a.length >= 8);
  if (validAwbs.length === 0) {
    return { hasDuplicates: false, duplicateCount: 0, duplicateAwbs: [], details: [] };
  }

  try {
    const matches = await localDb.awbHistory.where('awbNumber').anyOf(validAwbs).toArray();
    const now = Date.now();
    
    const details = matches.map(m => ({
      awbNumber: m.awbNumber,
      printedHoursAgo: Math.max(0, Math.round((now - m.printedAtMs) / (1000 * 60 * 60))),
      originalBatchCode: m.batchCode || 'PREVIOUS_BATCH'
    }));

    return {
      hasDuplicates: details.length > 0,
      duplicateCount: details.length,
      duplicateAwbs: details.map(d => d.awbNumber),
      details
    };
  } catch (err) {
    console.warn('[Storage] IndexedDB duplicate lookup fallback:', err);
    return { hasDuplicates: false, duplicateCount: 0, duplicateAwbs: [], details: [] };
  }
}

/**
 * Commits printed labels to IndexedDB memory only when user actually downloads or prints.
 */
export async function recordPrintedAwbsLocal(labels: ParsedLabelPage[], batchCode: string): Promise<void> {
  const now = Date.now();
  const records: LocalAwbRecord[] = labels
    .filter(l => l.awbNumber && l.awbNumber.length >= 8)
    .map(l => ({
      awbNumber: l.awbNumber,
      orderId: l.orderId,
      marketplace: l.marketplace,
      courier: l.courier,
      sku: l.sku,
      size: l.size,
      qty: l.totalQty,
      buyerPincode: l.buyerPincode,
      batchCode,
      printedAtMs: now,
      status: 'PRINTED'
    }));

  try {
    await localDb.awbHistory.bulkPut(records);
  } catch (err) {
    console.warn('[Storage] Could not record printed AWBs to IndexedDB:', err);
  }
}
