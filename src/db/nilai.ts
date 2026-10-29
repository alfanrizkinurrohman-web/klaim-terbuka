/**
 * Normalisasi nilai hasil query Arrow menjadi tipe JavaScript biasa.
 *
 * Dipakai oleh kedua implementasi koneksi (browser dan test) supaya bentuk
 * hasilnya identik, dan supaya aturan yang lulus test berperilaku sama di UI.
 */
import type { BarisHasil } from './types';

function duaAngka(n: number): string {
  return String(n).padStart(2, '0');
}

/** DATE dari DuckDB diubah menjadi "YYYY-MM-DD", bukan objek Date. */
function tanggalKeTeks(d: Date): string {
  return `${d.getUTCFullYear()}-${duaAngka(d.getUTCMonth() + 1)}-${duaAngka(d.getUTCDate())}`;
}

export function normalkanNilai(v: unknown): BarisHasil[string] {
  if (v === null || v === undefined) return null;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (v instanceof Date) return tanggalKeTeks(v);

  // Vector Arrow untuk kolom bertipe daftar.
  if (typeof v === 'object' && 'toArray' in v && typeof v.toArray === 'function') {
    const isi = (v as { toArray(): unknown[] }).toArray();
    return Array.from(isi, (x) => (x === null || x === undefined ? '' : String(x)));
  }
  if (Array.isArray(v)) {
    return v.map((x) => (x === null || x === undefined ? '' : String(x)));
  }
  return String(v);
}

export function normalkanBaris(baris: Record<string, unknown>): BarisHasil {
  const hasil: BarisHasil = {};
  for (const [k, v] of Object.entries(baris)) {
    hasil[k] = normalkanNilai(v);
  }
  return hasil;
}
