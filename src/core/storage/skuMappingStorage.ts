// FILE: src/core/storage/skuMappingStorage.ts
import { localDb, type LocalSkuMap } from './localDb.ts';

export interface SkuImportResult {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

/**
 * Parses a CSV line respecting standard quotes.
 */
function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Imports an Excel CSV or TSV file mapping Marketplace SKUs to Warehouse Rack/Bin locations.
 * Persists into Dexie IndexedDB (skuDictionary).
 */
export async function importSkuMappingCsv(content: string): Promise<SkuImportResult> {
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const result: SkuImportResult = {
    totalRows: lines.length,
    importedCount: 0,
    skippedCount: 0,
    errors: []
  };

  if (lines.length === 0) {
    result.errors.push('The file is empty.');
    return result;
  }

  // Detect delimiter (comma or tab)
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  // Check if first line is a header
  let startIndex = 0;
  const firstCols = parseCsvLine(firstLine, delimiter).map(c => c.toLowerCase());
  if (firstCols.some(c => c.includes('sku') || c.includes('product') || c.includes('rack') || c.includes('bin'))) {
    startIndex = 1;
  }

  const entriesToPut: LocalSkuMap[] = [];
  const now = Date.now();

  for (let i = startIndex; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    if (cols.length < 2) {
      result.skippedCount++;
      continue;
    }

    const rawSku = cols[0].replace(/^["']|["']$/g, '').trim();
    const rackCode = cols[1].replace(/^["']|["']$/g, '').trim();
    const packerNickname = cols[2] ? cols[2].replace(/^["']|["']$/g, '').trim() : '';

    if (!rawSku || !rackCode) {
      result.skippedCount++;
      continue;
    }

    entriesToPut.push({
      rawSku: rawSku.toUpperCase(),
      rackCode: rackCode.toUpperCase(),
      packerNickname: packerNickname,
      makingCostInr: 0,
      updatedAtMs: now
    });
  }

  if (entriesToPut.length > 0) {
    try {
      await localDb.skuDictionary.bulkPut(entriesToPut);
      result.importedCount = entriesToPut.length;
    } catch (err: any) {
      result.errors.push(`Failed to save to local storage: ${err.message || String(err)}`);
    }
  }

  return result;
}

/**
 * Returns total number of mapped SKUs stored in IndexedDB.
 */
export async function getSkuMappingCount(): Promise<number> {
  try {
    return await localDb.skuDictionary.count();
  } catch {
    return 0;
  }
}

/**
 * Clears all SKU mappings from IndexedDB.
 */
export async function clearAllSkuMappings(): Promise<void> {
  try {
    await localDb.skuDictionary.clear();
  } catch {
    // Ignore error
  }
}

/**
 * Generates sample CSV content for sellers to download as a template.
 */
export function generateSampleSkuMappingCsv(): string {
  return [
    'Marketplace SKU,Warehouse Rack Bin,Packer Nickname',
    'SAREE_RED_V1,RACK-A1,Red Saree',
    'KURTI_BLUE_XL,RACK-B3,Blue Kurti XL',
    'SHIRT_COTTON_WHITE,BIN-14,White Cotton Shirt',
    'TSHIRT_GRAPHIC_BLACK,BIN-08,Black Graphic Tee',
    'LEHENGA_BRIDAL_PINK,SAFE-02,Pink Bridal Lehenga'
  ].join('\r\n');
}
