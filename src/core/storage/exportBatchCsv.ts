// FILE: src/core/storage/exportBatchCsv.ts
import type { ParsedLabelPage } from '../../types/label.ts';

/**
 * Escapes a cell value for CSV formatting according to RFC 4180.
 * For long numeric strings (like AWBs and numeric Order IDs), formats as ="VALUE"
 * so Microsoft Excel on Windows treats them as exact text strings rather than
 * scientific notation (e.g. 1.23E+11).
 */
function formatCsvCell(val: string | number | boolean | undefined | null, forceText = false): string {
  if (val === undefined || val === null) return '""';
  const str = String(val).trim();
  
  // If forceText is true or value is a long digit sequence (> 9 digits), format as Excel text formula
  if (forceText || (/^\d{10,}$/.test(str))) {
    return `="""${str.replace(/"/g, '""""')}"""`;
  }

  // Standard CSV escaping
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Generates an Excel-compatible CSV string with UTF-8 Byte Order Mark (BOM).
 * UTF-8 BOM guarantees proper opening in Microsoft Excel without character encoding issues.
 */
export function generateBatchManifestCsv(labels: ParsedLabelPage[], batchCode: string): string {
  const headers = [
    'Seq #',
    'Batch Code',
    'Marketplace',
    'Courier Partner',
    'AWB Number',
    'Order ID',
    'Sub Order No',
    'Rescued SKU',
    'Warehouse Rack / Bin',
    'Apparel Size',
    'Color',
    'Pack Quantity',
    'Multi-Order Risk',
    'Payment Mode',
    'Buyer Destination Pincode',
    'Duplicate Blocked Status',
    'Dispatch Timestamp'
  ];

  const nowIso = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'medium'
  });

  const rows: string[] = [];
  // UTF-8 BOM
  rows.push('\uFEFF' + headers.map(h => formatCsvCell(h)).join(','));

  labels.forEach((label, idx) => {
    const isMulti = label.totalQty > 1;
    const multiText = isMulti ? `ALERT: PACK ${label.totalQty} PCS` : 'SINGLE';
    const rackText = label.rackCode && label.rackCode !== 'UNASSIGNED' ? label.rackCode : 'DEFAULT';
    const dupeStatus = label.isDuplicate ? 'DUPLICATE (BLOCKED)' : 'PASSED';

    const row = [
      formatCsvCell(idx + 1),
      formatCsvCell(batchCode),
      formatCsvCell(label.marketplace),
      formatCsvCell(label.courier),
      formatCsvCell(label.awbNumber, true), // forceText to prevent 1.23E+11 in Excel
      formatCsvCell(label.orderId, true),
      formatCsvCell(label.subOrderNo || label.orderId, true),
      formatCsvCell(label.sku),
      formatCsvCell(rackText),
      formatCsvCell(label.size || 'FREE'),
      formatCsvCell(label.color || 'STD'),
      formatCsvCell(label.totalQty),
      formatCsvCell(multiText),
      formatCsvCell(label.paymentMode || 'PREPAID'),
      formatCsvCell(label.buyerPincode || '-', true),
      formatCsvCell(dupeStatus),
      formatCsvCell(nowIso)
    ];

    rows.push(row.join(','));
  });

  return rows.join('\r\n');
}

/**
 * Triggers a browser download of the generated CSV manifest file.
 */
export function downloadBatchManifestCsv(labels: ParsedLabelPage[], batchCode: string): void {
  if (!labels || labels.length === 0) {
    alert('No active orders in this batch to export.');
    return;
  }

  const csvContent = generateBatchManifestCsv(labels, batchCode);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = `SmartLabelCrop_Manifest_${batchCode}_${dateTag}_${labels.length}orders.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
