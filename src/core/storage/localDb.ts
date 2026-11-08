// FILE: src/core/storage/localDb.ts
import Dexie, { type Table } from 'dexie';

export interface LocalAwbRecord {
  awbNumber: string;       // Primary Key
  orderId: string;
  marketplace: string;
  courier: string;
  sku: string;
  size: string;
  qty: number;
  buyerPincode: string;
  batchCode: string;
  printedAtMs: number;     // Indexed for 30-day TTL & duplicate warning
  status: 'PRINTED' | 'PACKED_SCANNED' | 'RTO_RECEIVED_GOOD' | 'RTO_RECEIVED_DAMAGED';
}

export interface LocalSkuMap {
  rawSku: string;          // Primary Key
  packerNickname: string;
  rackCode: string;
  makingCostInr: number;
  updatedAtMs: number;
}

export class SmartLabelLocalDb extends Dexie {
  awbHistory!: Table<LocalAwbRecord, string>;
  skuDictionary!: Table<LocalSkuMap, string>;

  constructor() {
    super('SmartLabelCropDB_v1');
    this.version(1).stores({
      awbHistory: 'awbNumber, orderId, printedAtMs, status',
      skuDictionary: 'rawSku, rackCode, updatedAtMs'
    });
  }
}

export const localDb = new SmartLabelLocalDb();
