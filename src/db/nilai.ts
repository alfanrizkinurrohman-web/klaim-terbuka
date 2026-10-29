/**
 * Normalisasi nilai hasil query Arrow menjadi tipe JavaScript biasa.
 *
 * Dipakai oleh kedua implementasi koneksi (browser dan test) supaya bentuk
 * hasilnya identik, dan supaya aturan yang lulus test berperilaku sama di UI.
 *
 * Ada dua hal yang WAJIB ditangani lewat skema Arrow, bukan dengan menerka dari
 * nilainya:
 *
 *   1. Kolom DATE. `toJSON()` milik Arrow mengubahnya menjadi ANGKA epoch
 *      milidetik, bukan objek Date — berlaku untuk Date32<DAY> maupun
 *      Date64<MILLISECOND>. Tanpa penanganan, tanggal muncul di UI dan di
 *      ekspor sebagai bilangan seperti 1780444800000.
 *
 *   2. Kolom DECIMAL. sum() atas BIGINT di DuckDB menghasilkan HUGEINT, yang
 *      di Arrow menjadi Decimal[38e0] dan dirender `toJSON()` sebagai STRING.
 *      Tanpa penanganan, seluruh angka pada ringkasan menjadi teks sehingga
 *      pengurutan dan pemformatan rupiah salah.
 *
 * Menerka dari nilainya tidak boleh dilakukan: kolom seperti kode rumah sakit
 * "0000000" adalah teks yang memang harus tetap teks.
 */
import type { BarisHasil } from './types';

/** typeId Arrow yang perlu perlakuan khusus. */
const ARROW_DATE = 8;
const ARROW_DECIMAL = 7;

export type JenisKolom = 'tanggal' | 'desimal';

interface SkemaArrowRingkas {
  fields: ReadonlyArray<{ name: string; type?: { typeId?: number } }>;
}

/** Kolom yang perlu perlakuan khusus pada sebuah hasil query. */
export function jenisKolomDariSkema(skema: SkemaArrowRingkas | undefined): Map<string, JenisKolom> {
  const peta = new Map<string, JenisKolom>();
  for (const f of skema?.fields ?? []) {
    if (f.type?.typeId === ARROW_DATE) peta.set(f.name, 'tanggal');
    else if (f.type?.typeId === ARROW_DECIMAL) peta.set(f.name, 'desimal');
  }
  return peta;
}

function duaAngka(n: number): string {
  return String(n).padStart(2, '0');
}

function tanggalKeTeks(d: Date): string {
  return `${d.getUTCFullYear()}-${duaAngka(d.getUTCMonth() + 1)}-${duaAngka(d.getUTCDate())}`;
}

/** Ubah epoch milidetik menjadi "YYYY-MM-DD". */
export function epochKeTanggal(ms: number): string | null {
  if (!Number.isFinite(ms)) return null;
  return tanggalKeTeks(new Date(ms));
}

/**
 * Ubah nilai desimal menjadi number. Bila nilainya di luar jangkauan bilangan
 * bulat yang aman di JavaScript, nilai dibiarkan sebagai teks: lebih baik
 * tampil apa adanya daripada kehilangan ketelitian tanpa disadari.
 */
function keAngkaDesimal(v: string | bigint | number): number | string {
  if (typeof v === 'number') return v;
  const teks = String(v);
  const n = Number(teks);
  if (!Number.isFinite(n)) return teks;
  if (Number.isInteger(n) && Math.abs(n) > Number.MAX_SAFE_INTEGER) return teks;
  return n;
}

export function normalkanNilai(v: unknown, jenis?: JenisKolom): BarisHasil[string] {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return tanggalKeTeks(v);

  if (jenis === 'tanggal') {
    if (typeof v === 'bigint') return epochKeTanggal(Number(v));
    if (typeof v === 'number') return epochKeTanggal(v);
    if (typeof v === 'string') return v;
  }

  if (jenis === 'desimal') {
    // Nilai DECIMAL/HUGEINT datang sebagai DecimalBigNum, yaitu subkelas
    // Uint32Array dengan toString() sendiri — jadi typeof-nya "object" dan
    // harus diubah lewat teksnya, bukan dibaca sebagai array.
    return keAngkaDesimal(typeof v === 'object' ? String(v) : (v as string | bigint | number));
  }

  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;

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

export function normalkanBaris(
  baris: Record<string, unknown>,
  jenisKolom: Map<string, JenisKolom> = new Map(),
): BarisHasil {
  const hasil: BarisHasil = {};
  for (const [k, v] of Object.entries(baris)) {
    hasil[k] = normalkanNilai(v, jenisKolom.get(k));
  }
  return hasil;
}
