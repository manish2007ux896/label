// FILE: src/core/pdf/parsers/amazonAndGlowroadParser.ts
import type { ParsedLabelPage, InvoiceLineItem } from '../../../types/label.ts';
import type { CourierId, MarketplaceId } from '../../../types/marketplace.ts';
import type { ReconstructedLine } from '../textReconstructor.ts';

/**
 * Parses Amazon Easy Ship shipping labels (4x6 thermal or A4 half-page).
 */
export function parseAmazonEasyShipPage(
  lines: ReconstructedLine[],
  sourceFileId: string,
  pageIndex: number,
  pageWidth = 595.28,
  pageHeight = 841.89
): ParsedLabelPage {
  const fullText = lines.map(l => l.text).join('\n');

  // Courier detection (ATS, Delhivery, Bluedart, etc.)
  let courier: CourierId = 'ATS';
  if (/delhivery/i.test(fullText)) courier = 'DELHIVERY';
  else if (/bluedart/i.test(fullText)) courier = 'BLUEDART';
  else if (/ecom\s*express/i.test(fullText)) courier = 'ECOM_EXPRESS';
  else if (/xpressbees/i.test(fullText)) courier = 'XPRESSBEES';
  else if (/ats|amazon\s*transportation/i.test(fullText)) courier = 'ATS';

  // Amazon Order ID pattern (e.g. 402-1234567-8901234)
  const orderMatch = fullText.match(/\b(\d{3}-\d{7}-\d{7})\b/) || fullText.match(/Order\s*ID\s*[:\-#]?\s*([A-Za-z0-9\-]+)/i);
  const orderId = orderMatch ? orderMatch[1].trim() : `AMZ_${pageIndex + 1}`;

  // AWB tracking
  const awbMatch = fullText.match(/(?:Tracking|AWB|Airway\s*Bill)\s*#?[:\s]*([A-Z0-9]{8,22})/i) ||
                   fullText.match(/\b([0-9]{12,18})\b/);
  const awbNumber = awbMatch ? awbMatch[1].trim() : orderId;

  // Destination Pincode
  const pinMatch = fullText.match(/\b([1-9][0-9]{5})\b/);
  const buyerPincode = pinMatch ? pinMatch[1] : '000000';

  // COD vs PREPAID
  const isCod = /\b(COD|Collect\s*Rs|Cash\s*on\s*Delivery)\b/i.test(fullText);
  const paymentMode: 'COD' | 'PREPAID' = isCod ? 'COD' : 'PREPAID';

  // SKU extraction
  const skuMatch = fullText.match(/(?:SKU|MSKU|Merchant\s*SKU|Item)\s*[:\-]?\s*([A-Za-z0-9_\-\.\/]{2,45})/i) ||
                  fullText.match(/(?:FNSKU|B0[A-Z0-9]{8})/);
  const sku = skuMatch ? skuMatch[1].trim() : 'AMAZON_ITEM';

  // Qty extraction
  const qtyMatch = fullText.match(/\b(?:Qty|Quantity)\s*[:\-]?\s*(\d{1,3})\b/i);
  let totalQty = 1;
  if (qtyMatch && qtyMatch[1]) {
    const q = parseInt(qtyMatch[1], 10);
    if (!isNaN(q) && q > 0) totalQty = q;
  }

  // Size & Color
  const sizeMatch = fullText.match(/\b(Size\s*[:\-]?\s*(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|FREE|\d{2}))\b/i);
  const size = sizeMatch ? sizeMatch[2].toUpperCase() : 'FREE';

  // Crop Box: Amazon 4x6 labels or A4 top-half (0 to 420 pt)
  const cropBox = pageHeight > 600
    ? { x0: 0, y0: 0, x1: pageWidth, y1: 420.0 }
    : { x0: 0, y0: 0, x1: pageWidth, y1: pageHeight };

  return {
    sourceFileId,
    sourceLabelPageIndex: pageIndex,
    marketplace: 'AMAZON',
    courier,
    awbNumber,
    orderId,
    subOrderNo: orderId,
    buyerPincode,
    paymentMode,
    sku,
    size,
    color: 'STD',
    totalQty,
    totalQuantity: totalQty,
    isMultiQuantity: totalQty > 1,
    lineItems: [{ sku, size, color: 'STD', qty: totalQty }],
    cropBoxTopDown: cropBox
  };
}

/**
 * Parses GlowRoad shipping labels.
 */
export function parseGlowroadPage(
  lines: ReconstructedLine[],
  sourceFileId: string,
  pageIndex: number,
  pageWidth = 595.28,
  pageHeight = 841.89
): ParsedLabelPage {
  const fullText = lines.map(l => l.text).join('\n');

  let courier: CourierId = 'OTHER';
  if (/delhivery/i.test(fullText)) courier = 'DELHIVERY';
  else if (/shadowfax/i.test(fullText)) courier = 'SHADOWFAX';
  else if (/xpressbees/i.test(fullText)) courier = 'XPRESSBEES';
  else if (/ecom\s*express/i.test(fullText)) courier = 'ECOM_EXPRESS';
  else if (/valmo/i.test(fullText)) courier = 'VALMO';

  const orderMatch = fullText.match(/\b(GLW\d{6,14})\b/i) ||
                    fullText.match(/Order\s*(?:ID|No|Number)\s*[:\-#]?\s*([A-Za-z0-9\-]{5,})/i);
  const orderId = orderMatch ? orderMatch[1].trim() : `GLW_${pageIndex + 1}`;

  const awbMatch = fullText.match(/(?:AWB|Tracking)\s*[:\-#]?\s*([A-Za-z0-9]{8,20})/i) ||
                   fullText.match(/\b(\d{12,18})\b/);
  const awbNumber = awbMatch ? awbMatch[1].trim() : orderId;

  const pinMatch = fullText.match(/\b([1-9][0-9]{5})\b/);
  const buyerPincode = pinMatch ? pinMatch[1] : '000000';

  const isCod = /\b(COD|CASH\s*ON\s*DELIVERY)\b/i.test(fullText);
  const paymentMode: 'COD' | 'PREPAID' = isCod ? 'COD' : 'PREPAID';

  const skuMatch = fullText.match(/SKU\s*[:\-]?\s*([A-Za-z0-9_\-\.\/]{2,45})/i);
  const sku = skuMatch ? skuMatch[1].trim() : 'GLOWROAD_ITEM';

  const qtyMatch = fullText.match(/\b(?:Qty|Quantity)\s*[:\-]?\s*(\d{1,3})\b/i);
  let totalQty = 1;
  if (qtyMatch && qtyMatch[1]) {
    const q = parseInt(qtyMatch[1], 10);
    if (!isNaN(q) && q > 0) totalQty = q;
  }

  const sizeMatch = fullText.match(/\b(Size\s*[:\-]?\s*(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|FREE|\d{2}))\b/i);
  const size = sizeMatch ? sizeMatch[2].toUpperCase() : 'FREE';

  return {
    sourceFileId,
    sourceLabelPageIndex: pageIndex,
    marketplace: 'GLOWROAD',
    courier,
    awbNumber,
    orderId,
    subOrderNo: orderId,
    buyerPincode,
    paymentMode,
    sku,
    size,
    color: 'STD',
    totalQty,
    totalQuantity: totalQty,
    isMultiQuantity: totalQty > 1,
    lineItems: [{ sku, size, color: 'STD', qty: totalQty }],
    cropBoxTopDown: { x0: 0, y0: 0, x1: pageWidth, y1: pageHeight > 600 ? 415.0 : pageHeight }
  };
}
