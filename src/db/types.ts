/**
 * Antarmuka basis data untuk rule engine.
 *
 * Ada dua implementasi dengan mesin yang SAMA (DuckDB-WASM):
 *   - di browser: bundle duckdb-browser (src/db/duckdbBrowser.ts)
 *   - di test   : bundle duckdb-node-blocking (tests/support/duckdbNode.ts)
 *
 * Karena mesinnya sama, SQL di berkas aturan berperilaku identik di keduanya.
 */

/** Satu baris hasil query; nilai sudah diubah ke tipe JavaScript biasa. */
export type BarisHasil = Record<string, string | number | boolean | string[] | null>;

export interface KoneksiKlaim {
  /** Jalankan query baca. Implementasi wajib menolak pernyataan yang mengubah data. */
  jalankan(sql: string): Promise<BarisHasil[]>;
  /** Jalankan pernyataan DDL/DML internal (pembuatan tabel, pemuatan data). */
  jalankanInternal(sql: string): Promise<void>;
  tutup(): Promise<void>;
}
