/**
 * Koneksi DuckDB di browser.
 *
 * Catatan privasi: berkas WASM dan worker DuckDB dimuat sebagai aset aplikasi
 * sendiri (di-bundel oleh Vite, disajikan dari origin yang sama), bukan dari
 * CDN. Yang berpindah lewat jaringan hanyalah mesin basis datanya, sekali saat
 * halaman dimuat — tidak ada data klaim yang keluar. Setelah aset itu ter-cache,
 * aplikasi tetap berfungsi tanpa jaringan.
 *
 * Pemuatan dari CDN (getJsDelivrBundles) TIDAK dipakai dengan sengaja: aplikasi
 * harus bisa dipakai di jaringan rumah sakit yang tertutup.
 */
import * as duckdb from '@duckdb/duckdb-wasm';
import wasmEh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import wasmMvp from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import workerEh from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import workerMvp from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';

import { jenisKolomDariSkema, normalkanBaris } from './nilai';
import type { BarisHasil, KoneksiKlaim } from './types';

const BUNDEL: duckdb.DuckDBBundles = {
  mvp: { mainModule: wasmMvp, mainWorker: workerMvp },
  eh: { mainModule: wasmEh, mainWorker: workerEh },
};

export interface KoneksiBrowser extends KoneksiKlaim {
  /** Dipakai UI untuk menampilkan versi mesin di halaman "tentang". */
  versi(): string;
}

export async function buatKoneksiBrowser(): Promise<KoneksiBrowser> {
  const bundel = await duckdb.selectBundle(BUNDEL);
  if (!bundel.mainWorker) {
    throw new Error('Peramban ini tidak mendukung WebAssembly yang dibutuhkan DuckDB.');
  }

  const worker = new Worker(bundel.mainWorker);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundel.mainModule, bundel.pthreadWorker ?? null);
  const koneksi = await db.connect();

  return {
    async jalankan(sql: string): Promise<BarisHasil[]> {
      const hasil = await koneksi.query(sql);
      const jenisKolom = jenisKolomDariSkema(hasil.schema);
      return hasil.toArray().map((baris) => normalkanBaris(baris.toJSON(), jenisKolom));
    },
    async jalankanInternal(sql: string): Promise<void> {
      await koneksi.query(sql);
    },
    async tutup(): Promise<void> {
      await koneksi.close();
      await db.terminate();
      worker.terminate();
    },
    versi(): string {
      return duckdb.PACKAGE_VERSION;
    },
  };
}
