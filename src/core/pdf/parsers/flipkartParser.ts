// FILE: src/core/pdf/parsers/flipkartParser.ts
import type { ParsedLabelPage, InvoiceLineItem } from '../../../types/label.ts';
import type { CourierId, MarketplaceId } from '../../../types/marketplace.ts';
import type { ReconstructedLine } from '../textReconstructor.ts';
import { MARKETPLACE_REGEX } from '../regexPatterns.ts';

export function parseFlipkartOrShopsyPage(
  lines: ReconstructedLine[],
  sourceFileId: string,
  pageIndex: number,
  pageWidth = 595.28,
  pageHeight = 841.89
): ParsedLabelPage {
  const fullText = lines.map(l => l.text).join('\n');
  const isShopsy = /\bSHOPSY\b/i.test(fullText);
  const marketplace: MarketplaceId = isShopsy ? 'SHOPSY' : 'FLIPKART';

  // Measure maximum X coordinate in top half to detect if label is bounded in top-left quadrant (x1 <= 340pt)
  const labelLines = lines.filter(l => l.y_top < 425);
  const maxLabelX = labelLines.reduce((max, l) => Math.max(max, l.x1_top), 305);
  const cropX1 = maxLabelX < 340 ? 308 : 577;

  // Courier detection: Delhivery vs Ekart
  let courier: CourierId = 'EKART';
  if (MARKETPLACE_REGEX.COURIER.DELHIVERY.test(fullText)) {
    courier = 'DELHIVERY';
  } else if (MARKETPLACE_REGEX.COURIER.ECOM_EXP.test(fullText)) {
    courier = 'ECOM_EXPRESS';
  }

  // Order ID & AWB
  const orderMatch = fullText.match(MARKETPLACE_REGEX.ORDER_FLIPKART);
  const orderId = orderMatch ? orderMatch[1] : `FLIPKART_${pageIndex + 1}`;

  const awbMatch = fullText.match(MARKETPLACE_REGEX.AWB_FLIPKART);
  const awbNumber = awbMatch ? awbMatch[1].toUpperCase() : orderId;

  // Buyer Pin Code
  const pinMatch = labelLines.map(l => l.text).join(' ').match(MARKETPLACE_REGEX.PIN_CODE);
  const buyerPincode = pinMatch ? pinMatch[1] : '000000';

  // Payment Mode
  const isCod = /\b(COD|CASH\s*ON\s*DELIVERY|FMPC)\b/i.test(fullText);
  const paymentMode: 'COD' | 'PREPAID' = isCod ? 'COD' : 'PREPAID';

  // SKU, Size, Color, Qty
  const skuMatch = fullText.match(/\bSKU\s*(?:ID)?\s*[:\-]?\s*([A-Za-z0-9_\-\.\/]{2,40})/i);
  const primarySku = skuMatch ? skuMatch[1].trim() : 'FK_ITEM';

  const sizeMatch = fullText.match(MARKETPLACE_REGEX.GENERIC_SIZE);
  const primarySize = sizeMatch ? sizeMatch[1].trim().toUpperCase() : 'FREE';

  const colorMatch = fullText.match(MARKETPLACE_REGEX.COLORS);
  const primaryColor = colorMatch ? colorMatch[1].toUpperCase() : 'STD';

  const qtyMatch = fullText.match(MARKETPLACE_REGEX.GENERIC_QTY);
  const totalQty = qtyMatch ? Math.max(1, parseInt(qtyMatch[1], 10)) : 1;

  const lineItems: InvoiceLineItem[] = [{
    sku: primarySku,
    size: primarySize,
    color: primaryColor,
    qty: totalQty
  }];

  return {
    sourceFileId,
    sourceLabelPageIndex: pageIndex,
    marketplace,
    courier,
    awbNumber,
    orderId,
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
      x1: cropX1,
      y1: 422
    }
  };
}
