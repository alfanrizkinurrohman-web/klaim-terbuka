/**
 * Mesin eksekusi aturan.
 *
 * Satu aturan dijalankan sebagai satu query baca terhadap tabel `klaim`.
 * Dua lapis penjagaan agar aturan tidak bisa mengubah data:
 *   1. skema aturan menolak kata kunci pengubah data (src/rules/schema.ts);
 *   2. query dibungkus sebagai sub-query di sini, sehingga pernyataan seperti
 *      DELETE menjadi galat sintaks dan bukan perintah yang terlaksana.
 */
import { hariLiburKosong } from '../db/muat';
import type { BarisHasil, KoneksiKlaim } from '../db/types';
import type { Aturan, ParameterAturan } from './schema';

/** Batas baris temuan per aturan, supaya UI tidak kebanjiran. */
export const BATAS_BARIS_BAWAAN = 5000;

export interface NilaiParameter {
  [idAturan: string]: Record<string, number | string>;
}

export interface HasilAturan {
  aturan: Aturan;
  baris: BarisHasil[];
  jumlah: number;
  /** True bila jumlah temuan melampaui batas dan daftar dipotong. */
  terpotong: boolean;
  /** Parameter yang betul-betul dipakai, setelah nilai bawaan diterapkan. */
  parameterTerpakai: Record<string, number | string>;
  /** Catatan untuk ditampilkan bersama hasil, mis. daftar hari libur kosong. */
  catatan: string[];
  /** Terisi bila query gagal dijalankan. */
  galat: string | null;
}

function nilaiAman(p: ParameterAturan, nilai: number | string): string {
  if (p.tipe === 'bilangan') {
    const n = typeof nilai === 'number' ? nilai : Number(nilai);
    if (!Number.isFinite(n)) {
      throw new Error(`parameter "${p.nama}" harus bilangan, diterima "${nilai}"`);
    }
    return String(n);
  }
  const s = String(nilai);
  if (!/^[A-Za-z0-9 ._-]*$/.test(s)) {
    throw new Error(
      `parameter "${p.nama}" memuat karakter yang tidak diizinkan; ` +
        'hanya huruf, angka, spasi, titik, garis bawah, dan tanda hubung',
    );
  }
  return `'${s}'`;
}

/** Ganti {{parameter}} di query dengan literal SQL yang sudah divalidasi. */
export function terapkanParameter(
  aturan: Aturan,
  nilai: Record<string, number | string> = {},
): { sql: string; terpakai: Record<string, number | string> } {
  const terpakai: Record<string, number | string> = {};
  let sql = aturan.query;

  for (const p of aturan.parameter) {
    const v = Object.prototype.hasOwnProperty.call(nilai, p.nama) ? nilai[p.nama]! : p.bawaan;
    terpakai[p.nama] = v;
    sql = sql.replace(new RegExp(`\\{\\{\\s*${p.nama}\\s*\\}\\}`, 'g'), nilaiAman(p, v));
  }

  const sisa = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/.exec(sql);
  if (sisa) {
    throw new Error(`parameter {{${sisa[1]}}} tidak tergantikan`);
  }
  return { sql, terpakai };
}

export interface OpsiJalankan {
  parameter?: NilaiParameter;
  batasBaris?: number;
}

/** Jalankan satu aturan. */
export async function jalankanAturan(
  koneksi: KoneksiKlaim,
  aturan: Aturan,
  opsi: OpsiJalankan = {},
): Promise<HasilAturan> {
  const batas = opsi.batasBaris ?? BATAS_BARIS_BAWAAN;
  const catatan: string[] = [];

  if (aturan.status === 'draft') {
    catatan.push(
      'Aturan ini berstatus draft dan perlu validasi koder: ambang atau rumusannya ' +
        'belum dipastikan terhadap regulasi.',
    );
  }

  let sql: string;
  let terpakai: Record<string, number | string>;
  try {
    const hasil = terapkanParameter(aturan, opsi.parameter?.[aturan.id]);
    sql = hasil.sql;
    terpakai = hasil.terpakai;
  } catch (e) {
    return {
      aturan,
      baris: [],
      jumlah: 0,
      terpotong: false,
      parameterTerpakai: {},
      catatan,
      galat: (e as Error).message,
    };
  }

  if (aturan.butuh_hari_libur) {
    try {
      if (await hariLiburKosong(koneksi)) {
        catatan.push(
          'Daftar hari libur nasional belum diisi (data/hari-libur/<tahun>.json masih ' +
            'placeholder), sehingga aturan ini baru mendeteksi hari Minggu.',
        );
      }
    } catch {
      catatan.push('Tabel hari libur tidak tersedia; aturan ini baru mendeteksi hari Minggu.');
    }
  }

  // Pembungkusan sub-query: lapis kedua penjagaan baca-saja.
  const sqlAman = `SELECT * FROM (\n${sql}\n)`;

  try {
    const baris = await koneksi.jalankan(sqlAman);
    const terpotong = baris.length > batas;
    return {
      aturan,
      baris: terpotong ? baris.slice(0, batas) : baris,
      jumlah: baris.length,
      terpotong,
      parameterTerpakai: terpakai,
      catatan,
      galat: null,
    };
  } catch (e) {
    return {
      aturan,
      baris: [],
      jumlah: 0,
      terpotong: false,
      parameterTerpakai: terpakai,
      catatan,
      galat: (e as Error).message,
    };
  }
}

/** Jalankan seluruh aturan secara berurutan. */
export async function jalankanSemuaAturan(
  koneksi: KoneksiKlaim,
  daftarAturan: Aturan[],
  opsi: OpsiJalankan = {},
): Promise<HasilAturan[]> {
  const hasil: HasilAturan[] = [];
  for (const a of daftarAturan) {
    hasil.push(await jalankanAturan(koneksi, a, opsi));
  }
  return hasil;
}
