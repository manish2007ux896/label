// FILE: src/types/marketplace.ts

export type MarketplaceId = 
  | 'MEESHO'
  | 'FLIPKART'
  | 'SHOPSY'
  | 'AMAZON'
  | 'JIOMART'
  | 'MYNTRA'
  | 'AJIO'
  | 'SNAPDEAL'
  | 'GLOWROAD'
  | 'GENERIC_3PL';

export type CourierId = 
  | 'VALMO'
  | 'DELHIVERY'
  | 'SHADOWFAX'
  | 'XPRESSBEES'
  | 'ECOM_EXPRESS'
  | 'EKART'
  | 'ATS'
  | 'BLUEDART'
  | 'DTDC'
  | 'OTHER';

export type OutputMode = 
  | 'THERMAL_4X6'           // Default: 288pt x 432pt (100mm x 150mm)
  | 'THERMAL_4X4_INVOICE'   // 288pt x 288pt (100mm x 100mm with invoice)
  | 'A4_4_IN_1_GRID'        // 595.28pt x 841.89pt (2x2 quadrant sticker sheet)
  | 'INVOICE_ONLY_A4'       // Sequenced A4 Tax Invoices Only
  | 'NO_CROP_SORTED_A4';    // Full A4 pages sorted by Courier/SKU

export type SortMode = 
  | 'COURIER_SKU_SIZE_QTY'  // Courier -> SKU -> Size -> Qty
  | 'SKU_SIZE_COURIER'      // SKU -> Size -> Courier
  | 'RACK_SKU_SIZE'         // Warehouse Rack -> SKU -> Size
  | 'COLOR_WITH_SIZE'       // Color -> Size
  | 'SIZE_WITH_COLOR';      // Size -> Color
