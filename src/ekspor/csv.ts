/**
 * Ekspor CSV.
 *
 * Pilihan yang disengaja:
 *   - BOM UTF-8 di awal, supaya Excel di Windows tidak salah membaca huruf
 *     beraksen pada nama pasien saat samaran dibuka;
 *   - akhir baris CRLF, sesuai RFC 4180 dan kebiasaan Excel;
 *   - pemisah titik koma, karena Excel berlokalisasi Indonesia memakai koma
 *     sebagai pemisah desimal dan akan menaruh seluruh baris di satu kolom
 *     bila CSV memakai koma.
 */
import { nilaiKeTeks } from './tabel';
import type { TabelEkspor } from './tabel';

export const PEMISAH_CSV = ';';
const BOM = '﻿';
const CRLF = '\r\n';

function sel(teks: string): string {
  // Kutip bila ada pemisah, tanda kutip, atau pindah baris.
  if (/[";\r\n]/.test(teks)) {
    return `"${teks.replace(/"/g, '""')}"`;
  }
  return teks;
}

/** Ubah satu tabel menjadi teks CSV. */
export function tabelKeCsv(tabel: TabelEkspor): string {
  const baris: string[] = [];

  for (const c of tabel.catatan) {
    baris.push(sel(`# ${c}`));
  }
  if (tabel.catatan.length > 0) baris.push('');

  baris.push(tabel.kolom.map((k) => sel(k.label)).join(PEMISAH_CSV));
  for (const b of tabel.baris) {
    baris.push(tabel.kolom.map((k) => sel(nilaiKeTeks(b[k.nama] ?? null))).join(PEMISAH_CSV));
  }

  return BOM + baris.join(CRLF) + CRLF;
}

export function csvKeBytes(csv: string): Uint8Array {
  return new TextEncoder().encode(csv);
}
