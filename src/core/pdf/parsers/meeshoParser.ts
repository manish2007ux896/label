// FILE: src/core/pdf/parsers/meeshoParser.ts
import type { ParsedLabelPage, InvoiceLineItem } from '../../../types/label.ts';
import type { CourierId } from '../../../types/marketplace.ts';
import type { ReconstructedLine } from '../textReconstructor.ts';
import { findTaxInvoiceDividerY } from '../dynamicAnchorFinder.ts';
import { MARKETPLACE_REGEX } from '../regexPatterns.ts';

export function parseMeeshoPage(
  lines: ReconstructedLine[],
  sourceFileId: string,
  pageIndex: number,
  pageWidth = 595.28,
  pageHeight = 841.89
): ParsedLabelPage {
  const dividerY = findTaxInvoiceDividerY(lines, 404.0);
  
  const labelLines = lines.filter(l => l.y_top <= dividerY);
  const invoiceLines = lines.filter(l => l.y_top > dividerY);

  const labelText = labelLines.map(l => l.text).join('\n');
  const invoiceText = invoiceLines.map(l => l.text).join('\n');
  const fullText = lines.map(l => l.text).join('\n');

  // 1. Detect Courier Partner
  let courier: CourierId = 'OTHER';
  if (MARKETPLACE_REGEX.COURIER.VALMO.test(labelText)) courier = 'VALMO';
  else if (MARKETPLACE_REGEX.COURIER.DELHIVERY.test(labelText)) courier = 'DELHIVERY';
  else if (MARKETPLACE_REGEX.COURIER.SHADOWFAX.test(labelText)) courier = 'SHADOWFAX';
  else if (MARKETPLACE_REGEX.COURIER.XPRESSBEES.test(labelText)) courier = 'XPRESSBEES';
  else if (MARKETPLACE_REGEX.COURIER.ECOM_EXP.test(labelText)) courier = 'ECOM_EXPRESS';
  else if (MARKETPLACE_REGEX.COURIER.EKART.test(labelText)) courier = 'EKART';

  // 2. Extract Sub-Order No
  const subOrderMatch = labelText.match(MARKETPLACE_REGEX.ORDER_MEESHO) || fullText.match(MARKETPLACE_REGEX.ORDER_MEESHO);
  const subOrderNo = subOrderMatch ? subOrderMatch[1] : `MEESHO_${pageIndex + 1}`;

  // 3. Extract AWB Number
  const awbExplicit = labelText.match(/(?:AWB|Tracking|Airway\s*Bill|Tracking\s*No)\s*[:\-#]?\s*([A-Z0-9]{9,18})/i);
  const awbGeneric = labelText.match(MARKETPLACE_REGEX.AWB_MEESHO);
  const awbNumber = awbExplicit ? awbExplicit[1].trim() : (awbGeneric ? awbGeneric[1].trim() : subOrderNo);

  // 4. Extract 6-digit Indian Pin Code
  const pinMatch = labelText.match(MARKETPLACE_REGEX.PIN_CODE);
  const buyerPincode = pinMatch ? pinMatch[1] : '000000';

  // 5. Payment Mode (COD vs Prepaid)
  const isCod = /\b(COD|CASH\s*ON\s*DELIVERY)\b/i.test(labelText);
  const paymentMode: 'COD' | 'PREPAID' = isCod ? 'COD' : 'PREPAID';

  // 6. Rescue SKU, Size, Color, Qty from Bottom Tax Invoice
  const lineItems: InvoiceLineItem[] = [];
  
  // Look for SKU, Size, Qty in invoice rows
  const skuMatches = [...invoiceText.matchAll(/SKU\s*[:\-]?\s*([A-Za-z0-9_\-\.\/]{2,45})/gi)];
  const sizeMatches = [...invoiceText.matchAll(/Size\s*[:\-]?\s*(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL|FREE\s*SIZE|\d{2})/gi)];
  const qtyMatches = [...invoiceText.matchAll(/\b(?:Qty|Quantity)\s*[:\-]?\s*(\d{1,3})\b/gi)];

  let primarySku = 'MEESHO_ITEM';
  let primarySize = 'FREE';
  let primaryColor = 'STD';
  let totalQty = 1;

  if (skuMatches.length > 0 && skuMatches[0] && skuMatches[0][1]) {
    primarySku = skuMatches[0][1].trim();
  }

  if (sizeMatches.length > 0 && sizeMatches[0] && sizeMatches[0][1]) {
    primarySize = sizeMatches[0][1].trim().toUpperCase();
  }

  if (qtyMatches.length > 0 && qtyMatches[0] && qtyMatches[0][1]) {
    totalQty = Math.max(1, parseInt(qtyMatches[0][1], 10));
  }

  // Extract color token if present in SKU or product description
  const colorMatch = fullText.match(MARKETPLACE_REGEX.COLORS);
  if (colorMatch && colorMatch[1]) {
    primaryColor = colorMatch[1].toUpperCase();
  }

  lineItems.push({
    sku: primarySku,
    size: primarySize,
    color: primaryColor,
    qty: totalQty
  });

  return {
    sourceFileId,
    sourceLabelPageIndex: pageIndex,
    marketplace: 'MEESHO',
    courier,
    awbNumber,
    orderId: subOrderNo,
    subOrderNo,
    buyerPincode,
    paymentMode,
    sku: primarySku,
    size: primarySize,
    color: primaryColor,
    totalQty,
    totalQuantity: totalQty,
    isMultiQuantity: totalQty > 1,
    lineItems,
    cropBoxTopDown: {
      x0: 18,
      y0: 16,
      x1: 577,
      y1: dividerY
    }
  };
}
