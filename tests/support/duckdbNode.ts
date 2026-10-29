/**
 * Koneksi DuckDB untuk test.
 *
 * Memakai bundle duckdb-node-blocking dari paket @duckdb/duckdb-wasm — mesin
 * WASM yang SAMA dengan yang dipakai di browser, hanya runtime-nya Node. Jadi
 * SQL di berkas aturan diuji pada mesin yang sebenarnya, bukan pada basis data
 * lain yang kebetulan mirip.
 *
 * Berkas ini hanya untuk test dan tidak ikut dibundel ke aplikasi.
 */
import { createRequire } from 'node:module';
import path from 'node:path';

import { normalkanBaris } from '../../src/db/nilai';
import type { BarisHasil, KoneksiKlaim } from '../../src/db/types';

const require = createRequire(import.meta.url);

interface BundleDuckDb {
  mainModule: string;
  mainWorker: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function buatKoneksiUji(): Promise<KoneksiKlaim> {
  const duckdb = require('@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs') as any;
  const dist = path.dirname(
    require.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs'),
  );

  const bundles: Record<string, BundleDuckDb> = {
    mvp: {
      mainModule: path.join(dist, 'duckdb-mvp.wasm'),
      mainWorker: path.join(dist, 'duckdb-node-mvp.worker.cjs'),
    },
    eh: {
      mainModule: path.join(dist, 'duckdb-eh.wasm'),
      mainWorker: path.join(dist, 'duckdb-node-eh.worker.cjs'),
    },
  };

  const db = await duckdb.createDuckDB(bundles, new duckdb.VoidLogger(), duckdb.NODE_RUNTIME);
  await db.instantiate();
  const conn = db.connect();

  return {
    async jalankan(sql: string): Promise<BarisHasil[]> {
      const hasil = conn.query(sql);
      return hasil.toArray().map((baris: any) => normalkanBaris(baris.toJSON()));
    },
    async jalankanInternal(sql: string): Promise<void> {
      conn.query(sql);
    },
    async tutup(): Promise<void> {
      conn.close();
    },
  };
}
