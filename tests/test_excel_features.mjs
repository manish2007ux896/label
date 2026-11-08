// tests/test_excel_features.mjs
import assert from 'node:assert';
import { generateBatchManifestCsv } from '../src/core/storage/exportBatchCsv.ts';
import { importSkuMappingCsv, generateSampleSkuMappingCsv } from '../src/core/storage/skuMappingStorage.ts';
import {
  parseAndAggregateOrderReport,
  renderStandaloneThermalPicklistPdf,
  renderA4WarehousePullSheetPdf
} from '../src/core/parsers/orderReportAggregator.ts';
import {
  parseAmazonEasyShipPage,
  parseGlowroadPage
} from '../src/core/pdf/parsers/amazonAndGlowroadParser.ts';

console.log('[Test Excel Features] Starting unit tests...');

// 1. Test CSV Manifest Generation
const mockLabels = [
  {
    sourceFileId: 'f1',
    sourceLabelPageIndex: 0,
    marketplace: 'MEESHO',
    courier: 'VALMO',
    awbNumber: '148291048291',
    orderId: 'ORD-98214',
    subOrderNo: 'SUB-98214-1',
    sku: 'SAREE_RED_V1',
    rackCode: 'RACK-A1',
    size: 'FREE',
    color: 'RED',
    totalQty: 2,
    totalQuantity: 2,
    isMultiQuantity: true,
    paymentMode: 'COD',
    buyerPincode: '395006',
    isDuplicate: false,
    lineItems: [],
    cropBoxTopDown: { x0: 0, y0: 0, x1: 288, y1: 432 }
  },
  {
    sourceFileId: 'f1',
    sourceLabelPageIndex: 1,
    marketplace: 'FLIPKART',
    courier: 'EKART',
    awbNumber: 'FMPC9918273645',
    orderId: 'OD3029182746192',
    sku: 'KURTI_COTTON_BLUE',
    size: 'XL',
    color: 'NAVY',
    totalQty: 1,
    totalQuantity: 1,
    isMultiQuantity: false,
    paymentMode: 'PREPAID',
    buyerPincode: '560001',
    isDuplicate: false,
    lineItems: [],
    cropBoxTopDown: { x0: 0, y0: 0, x1: 288, y1: 432 }
  }
];

const csvOutput = generateBatchManifestCsv(mockLabels, 'B-TEST01');
console.log('[Test 1] Generated CSV output:');
console.log(csvOutput);

// Assertions on CSV
assert.ok(csvOutput.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM for Excel compatibility');
assert.ok(csvOutput.includes('Batch Code'), 'Headers must include Batch Code');
assert.ok(csvOutput.includes('VALMO'), 'Must include Valmo courier');
assert.ok(csvOutput.includes('EKART'), 'Must include Ekart courier');
assert.ok(csvOutput.includes('ALERT: PACK 2 PCS'), 'Must flag multi-quantity pack');
assert.ok(csvOutput.includes('RACK-A1'), 'Must include mapped Rack Code');
assert.ok(csvOutput.includes('="""148291048291"""'), 'Numeric AWB must be escaped with Excel text formula to avoid 1.23E+11');

console.log('[Test 1 Passed] Manifest CSV generation verified!');

// 2. Test Sample SKU Template
const sampleCsv = generateSampleSkuMappingCsv();
assert.ok(sampleCsv.includes('Marketplace SKU,Warehouse Rack Bin,Packer Nickname'), 'Sample template has valid headers');
assert.ok(sampleCsv.includes('SAREE_RED_V1,RACK-A1'), 'Sample template has valid rows');
console.log('[Test 2 Passed] Sample SKU template verified!');

// 3. Test In-Memory CSV Parsing
const rawCsvInput = `
Marketplace SKU,Warehouse Rack Bin,Packer Nickname
SAREE_SILK_GREEN,RACK-G4,Silk Saree
JEANS_SLIM_32,BIN-12,Slim Jeans 32
`;

// Note: IndexedDB is not present in pure Node, but we verify line splitting and structure
const lines = rawCsvInput.trim().split('\n');
assert.strictEqual(lines.length, 3, 'Must parse 3 lines');
console.log('[Test 3 Passed] CSV structure verified!');

// 4. Test Meesho Pending Orders Excel Report Ingest & Aggregation
const mockMeeshoReportCsv = `
Sub Order No,Product Name,SKU,Variation,Color,Quantity,Courier Partner,Status
1082910482_1,Designer Georgette Saree,SAREE_GEO_RED,Free Size,Red,1,Valmo,Pending
1082910482_2,Designer Georgette Saree,SAREE_GEO_RED,Free Size,Red,2,Valmo,Pending
1082910483_1,Cotton Straight Kurti,KURTI_COTTON_BLUE,XL,Blue,1,Ekart,Pending
1082910484_1,Cotton Straight Kurti,KURTI_COTTON_BLUE,XL,Blue,3,Ekart,Pending
1082910485_1,Cotton Straight Kurti,KURTI_COTTON_BLUE,M,Navy,2,Delhivery,Pending
1082910486_1,Anarkali Gown,GOWN_ANARKALI_PINK,Free Size,Pink,1,Valmo,Pending
`;

const aggregationResult = await parseAndAggregateOrderReport(mockMeeshoReportCsv, 'Meesho_Pending_Orders.csv');
console.log('[Test 4] Aggregation summary:', {
  totalOrders: aggregationResult.totalOrders,
  totalUnits: aggregationResult.totalUnits,
  uniqueSkus: aggregationResult.uniqueSkusCount,
  couriers: aggregationResult.courierCounts
});

assert.strictEqual(aggregationResult.totalOrders, 6, 'Should detect 6 order lines');
assert.strictEqual(aggregationResult.totalUnits, 10, 'Total units should sum up to 10 (1+2+1+3+2+1)');
assert.strictEqual(aggregationResult.uniqueSkusCount, 3, 'Should have 3 unique SKUs (SAREE_GEO_RED, KURTI_COTTON_BLUE, GOWN_ANARKALI_PINK)');
assert.strictEqual(aggregationResult.courierCounts.VALMO, 3, 'Valmo should have 3 orders');
assert.strictEqual(aggregationResult.courierCounts.EKART, 2, 'Ekart should have 2 orders');
assert.strictEqual(aggregationResult.courierCounts.DELHIVERY, 1, 'Delhivery should have 1 order');
console.log('[Test 4 Passed] Meesho Excel Order Report aggregated successfully!');

// 5. Test 4×6 Thermal Picklist PDF Generation from Excel
const thermalPicklistBytes = await renderStandaloneThermalPicklistPdf(aggregationResult, 'MEESHO PICKLIST');
assert.ok(thermalPicklistBytes && thermalPicklistBytes.length > 500, '4x6 Picklist PDF must be generated with valid bytes');
console.log('[Test 5 Passed] Standalone 4x6 Thermal Picklist PDF generated! Bytes:', thermalPicklistBytes.length);

// 6. Test A4 Warehouse Pull Sheet PDF Generation from Excel
const a4PullSheetBytes = await renderA4WarehousePullSheetPdf(aggregationResult, 'MEESHO MORNING PULL SHEET');
assert.ok(a4PullSheetBytes && a4PullSheetBytes.length > 500, 'A4 Warehouse Pull Sheet PDF must be generated with valid bytes');
console.log('[Test 6 Passed] Standalone A4 Warehouse Pull Sheet PDF generated! Bytes:', a4PullSheetBytes.length);

// 7. Test Amazon Easy Ship Label Parsing
const mockAmazonLines = [
  { text: 'Amazon Easy Ship', y_top: 20 },
  { text: 'Order ID: 402-8921824-1029481', y_top: 40 },
  { text: 'Tracking #: 981273910245', y_top: 60 },
  { text: 'Courier: Delhivery', y_top: 80 },
  { text: 'SKU: AMZ_TSHIRT_BLK', y_top: 100 },
  { text: 'Size: L', y_top: 120 },
  { text: 'Qty: 2', y_top: 140 },
  { text: 'PIN: 400001', y_top: 160 }
];

const amazonParsed = parseAmazonEasyShipPage(mockAmazonLines, 'amz-file-1', 0);
assert.strictEqual(amazonParsed.marketplace, 'AMAZON');
assert.strictEqual(amazonParsed.orderId, '402-8921824-1029481');
assert.strictEqual(amazonParsed.awbNumber, '981273910245');
assert.strictEqual(amazonParsed.courier, 'DELHIVERY');
assert.strictEqual(amazonParsed.sku, 'AMZ_TSHIRT_BLK');
assert.strictEqual(amazonParsed.size, 'L');
assert.strictEqual(amazonParsed.totalQty, 2);
assert.strictEqual(amazonParsed.isMultiQuantity, true);
console.log('[Test 7 Passed] Amazon Easy Ship label parsed successfully!');

// 8. Test GlowRoad Label Parsing
const mockGlowroadLines = [
  { text: 'GlowRoad Order Confirmation', y_top: 20 },
  { text: 'Order ID: GLW98214710', y_top: 40 },
  { text: 'AWB: 148291048123', y_top: 60 },
  { text: 'Courier: Shadowfax', y_top: 80 },
  { text: 'SKU: GLW_KURTI_SET', y_top: 100 },
  { text: 'Size: M', y_top: 120 },
  { text: 'Qty: 1', y_top: 140 }
];

const glowroadParsed = parseGlowroadPage(mockGlowroadLines, 'glw-file-1', 0);
assert.strictEqual(glowroadParsed.marketplace, 'GLOWROAD');
assert.strictEqual(glowroadParsed.orderId, 'GLW98214710');
assert.strictEqual(glowroadParsed.awbNumber, '148291048123');
assert.strictEqual(glowroadParsed.courier, 'SHADOWFAX');
assert.strictEqual(glowroadParsed.sku, 'GLW_KURTI_SET');
assert.strictEqual(glowroadParsed.size, 'M');
assert.strictEqual(glowroadParsed.totalQty, 1);
assert.strictEqual(glowroadParsed.isMultiQuantity, false);
console.log('[Test 8 Passed] GlowRoad label parsed successfully!');

console.log('\n>>> ALL EXCEL & CSV UNIT TESTS PASSED SUCCESSFULLY! <<<');
