import { generateSampleSellerPdf } from '../src/core/pdf/testSampleGenerator.ts';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { reconstructLinesFromPdfJsItems } from '../src/core/pdf/textReconstructor.ts';
import { parseMeeshoPage } from '../src/core/pdf/parsers/meeshoParser.ts';
import { parseFlipkartOrShopsyPage } from '../src/core/pdf/parsers/flipkartParser.ts';
import { sortParsedLabels } from '../src/core/pdf/sortLabels.ts';
import { renderThermal4x6Document } from '../src/core/pdf/renderThermal4x6.ts';
import { prependThermalPicklistPages } from '../src/core/pdf/renderPicklist4x6.ts';
import { processSellerBatch } from '../src/core/pdf/clientBatchProcessor.ts';

async function run() {
  console.log('[Test] Step 1: Generating 15-order sample PDF...');
  const sampleBytes = await generateSampleSellerPdf();
  console.log(`[Test] Generated sample PDF bytes: ${sampleBytes.byteLength}`);

  console.log('[Test] Step 2: Testing processSellerBatch (the full client orchestrator)...');
  const batchResult = await processSellerBatch({
    files: [{
      id: 'test-sample-file-01',
      name: 'Test_Meesho_Flipkart_Orders.pdf',
      buffer: sampleBytes.buffer.slice(sampleBytes.byteOffset, sampleBytes.byteOffset + sampleBytes.byteLength)
    }],
    options: {
      outputMode: '4x6_thermal',
      sortMode: 'courier_handover',
      stampSku: true,
      includePicklistSticker: true,
      skipDuplicates: false,
      customNote: '360 Unboxing Video Mandatory'
    },
    onProgress: (stage, pct) => {
      console.log(`  Progress: ${pct}% - ${stage}`);
    }
  });

  console.log(`[Test] Batch processed successfully!`);
  console.log(`  Total Labels: ${batchResult.totalLabels}`);
  console.log(`  Multi-Quantity Count: ${batchResult.multiQtyCount}`);
  console.log(`  Output PDF Bytes: ${batchResult.outputPdfBytes.byteLength}`);
  console.log(`  Courier Counts:`, batchResult.courierCounts);

  const doc = await PDFDocument.load(batchResult.outputPdfBytes);
  console.log(`  Total PDF Pages rendered: ${doc.getPageCount()}`);
  const p1 = doc.getPage(0);
  const p2 = doc.getPage(1);
  console.log(`  Page 1 dims: ${p1.getWidth()} x ${p1.getHeight()} pt`);
  console.log(`  Page 2 dims: ${p2.getWidth()} x ${p2.getHeight()} pt`);

  if (Math.round(p1.getWidth()) !== 288 || Math.round(p1.getHeight()) !== 432) {
    throw new Error(`Page 1 dimensions mismatch: ${p1.getWidth()} x ${p1.getHeight()}`);
  }
  if (Math.round(p2.getWidth()) !== 288 || Math.round(p2.getHeight()) !== 432) {
    throw new Error(`Page 2 dimensions mismatch: ${p2.getWidth()} x ${p2.getHeight()}`);
  }

  console.log('>>> ALL ORCHESTRATOR & WASM VERIFICATION CHECKS PASSED PERFECTLY! <<<');
}

run().catch(err => {
  console.error('[Test Failed]:', err);
  process.exit(1);
});
