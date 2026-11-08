// FILE: src/types/label.ts
import type { MarketplaceId, CourierId } from './marketplace';

export interface BoundingBoxPt {
  x0_top: number; // Left edge from page left in points (72pt = 1 inch)
  y0_top: number; // Top edge from page TOP in points
  x1_top: number; // Right edge from page left in points
  y1_top: number; // Bottom edge from page TOP in points
}

export interface InvoiceLineItem {
  sku: string;
  size: string;
  color: string;
  qty: number;
  hsn?: string;
  taxableValueInr?: number;
}

export interface ParsedLabelPage {
  sourceFileId: string;
  sourceLabelPageIndex: number;
  marketplace: MarketplaceId;
  courier: CourierId;
  awbNumber: string;
  orderId: string;
  subOrderNo?: string;
  buyerPincode: string;
  paymentMode: 'COD' | 'PREPAID';
  codCollectibleInr?: number;
  sellerGstin?: string;
  storeNickname?: string;
  sku: string;
  packerNickname?: string;
  rackCode?: string;
  size: string;
  color: string;
  totalQty: number;
  totalQuantity: number;
  isMultiQuantity: boolean;
  lineItems: InvoiceLineItem[];
  cropBoxTopDown: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  rotationDegrees?: 0 | 90 | 180 | 270;
  isDuplicate?: boolean;
  duplicatePreviousBatch?: string;
  isHighRtoPincode?: boolean;
}
