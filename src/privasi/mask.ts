/**
 * Penyamaran (masking) kolom identitas.
 *
 * Aturan dasar: kolom identitas DISAMARKAN secara bawaan di mana pun
 * ditampilkan maupun diekspor. Membuka samaran harus berupa tindakan sadar
 * pengguna, dan pemanggil wajib menyatakannya lewat `bukaSamaran: true` —
 * tidak ada jalur yang membuka samaran secara diam-diam.
 *
 * Penyamaran di sini hanya untuk tampilan. Nilai aslinya tetap ada di memori
 * karena dibutuhkan untuk analisis (mis. nomor rekam medis sebagai kunci
 * readmisi); yang dijaga adalah apa yang terlihat di layar dan apa yang keluar
 * lewat ekspor.
 */
import type { BarisHasil } from '../db/types';
import type { ColumnMap } from '../parser/columnMap';
import { kolomIdentitas } from '../parser/columnMap';

/** Cara menyamarkan tiap kolom identitas. */
type Gaya = 'nama' | 'ekor' | 'tahun' | 'penuh';

const GAYA: Record<string, Gaya> = {
  nama_pasien: 'nama',
  mrn: 'ekor',
  sep: 'ekor',
  nomor_kartu: 'ekor',
  tanggal_lahir: 'tahun',
  dpjp: 'penuh',
  coder_id: 'penuh',
  coder_ref: 'penuh',
  coder_id_2: 'penuh',
};

const SAMAR = '•';

/** "SITI AMINAH" -> "S••• A•••" */
function samarkanNama(v: string): string {
  return v
    .split(/\s+/)
    .filter((k) => k !== '')
    .map((k) => (k.length <= 1 ? k : k[0] + SAMAR.repeat(Math.min(3, k.length - 1))))
    .join(' ');
}

/** "0012345678901" -> "•••••••••8901" (empat karakter terakhir disisakan) */
function samarkanEkor(v: string, disisakan = 4): string {
  if (v.length <= disisakan) return SAMAR.repeat(v.length);
  return SAMAR.repeat(v.length - disisakan) + v.slice(-disisakan);
}

/** "1904-07-21" -> "1904" (tahun saja; umur tetap bisa dinilai) */
function samarkanTahun(v: string): string {
  const cocok = /^(\d{4})-\d{2}-\d{2}$/.exec(v);
  return cocok ? (cocok[1] as string) : SAMAR.repeat(v.length);
}

/** "SPAN-07" -> "SP•••" (dua karakter pertama disisakan agar tetap bisa dibedakan) */
function samarkanPenuh(v: string, disisakan = 2): string {
  if (v.length <= disisakan) return SAMAR.repeat(v.length);
  return v.slice(0, disisakan) + SAMAR.repeat(Math.min(3, v.length - disisakan));
}

/** Samarkan satu nilai sesuai gaya kolomnya. */
export function samarkanNilai(nama: string, nilai: unknown): string | null {
  if (nilai === null || nilai === undefined || nilai === '') return null;
  const v = String(nilai);
  switch (GAYA[nama] ?? 'penuh') {
    case 'nama':
      return samarkanNama(v);
    case 'ekor':
      return samarkanEkor(v);
    case 'tahun':
      return samarkanTahun(v);
    default:
      return samarkanPenuh(v);
  }
}

export interface OpsiSamaran {
  /** Nama kolom tambahan yang juga harus disamarkan, mis. alias di query aturan. */
  kolomTambahan?: string[];
  /**
   * Buka samaran. Hanya boleh true karena pengguna memintanya secara eksplisit;
   * jangan pernah diisi dari nilai bawaan atau konfigurasi.
   */
  bukaSamaran?: boolean;
}

/** Himpunan nama kolom yang harus disamarkan. */
export function kolomDisamarkan(map: ColumnMap, kolomTambahan: string[] = []): Set<string> {
  return new Set([...kolomIdentitas(map), ...kolomTambahan]);
}

/** Samarkan satu baris hasil. */
export function samarkanBaris(
  baris: BarisHasil,
  disamarkan: Set<string>,
  bukaSamaran = false,
): BarisHasil {
  if (bukaSamaran) return baris;
  const hasil: BarisHasil = {};
  for (const [k, v] of Object.entries(baris)) {
    hasil[k] = disamarkan.has(k) ? samarkanNilai(k, v) : v;
  }
  return hasil;
}

/** Samarkan sekumpulan baris hasil, mis. sebelum diekspor ke CSV. */
export function samarkanSemua(
  baris: BarisHasil[],
  map: ColumnMap,
  opsi: OpsiSamaran = {},
): BarisHasil[] {
  const disamarkan = kolomDisamarkan(map, opsi.kolomTambahan);
  return baris.map((b) => samarkanBaris(b, disamarkan, opsi.bukaSamaran));
}
