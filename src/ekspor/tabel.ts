/**
 * Bentuk tabel yang siap diekspor.
 *
 * Penyamaran identitas diterapkan DI SINI, satu kali, sebelum data berubah
 * menjadi CSV atau Excel. Dengan begitu tidak ada jalur ekspor yang bisa lupa
 * menyamarkan.
 */
import type { BarisHasil } from '../db/types';
import type { ColumnMap } from '../parser/columnMap';
import { kolomDisamarkan, samarkanBaris } from '../privasi/mask';

export interface KolomTabel {
  nama: string;
  label: string;
  format?: 'teks' | 'angka' | 'rupiah' | 'tanggal' | 'daftar';
  identitas?: boolean;
}

export interface TabelEkspor {
  /** Nama lembar / berkas. */
  nama: string;
  kolom: KolomTabel[];
  baris: BarisHasil[];
  /** Keterangan yang ditulis di atas tabel, mis. status draft aturan. */
  catatan: string[];
  /** True bila identitas pada tabel ini masih tersamarkan. */
  tersamarkan: boolean;
}

export interface OpsiTabel {
  /**
   * Buka samaran identitas. Hanya boleh true karena pengguna memintanya
   * secara eksplisit di UI, dan pilihan itu dicatat di tabel hasil.
   */
  bukaSamaran?: boolean;
}

/**
 * Siapkan satu tabel untuk diekspor: pilih kolom sesuai label, lalu samarkan.
 */
export function siapkanTabel(
  nama: string,
  kolom: KolomTabel[],
  baris: BarisHasil[],
  map: ColumnMap,
  catatan: string[] = [],
  opsi: OpsiTabel = {},
): TabelEkspor {
  const buka = opsi.bukaSamaran === true;
  const tambahan = kolom.filter((k) => k.identitas).map((k) => k.nama);
  const disamarkan = kolomDisamarkan(map, tambahan);

  const terpilih = baris.map((b) => {
    const aman = samarkanBaris(b, disamarkan, buka);
    const hasil: BarisHasil = {};
    for (const k of kolom) {
      hasil[k.nama] = aman[k.nama] ?? null;
    }
    return hasil;
  });

  const catatanLengkap = [...catatan];
  catatanLengkap.push(
    buka
      ? 'PERHATIAN: identitas pada berkas ini TIDAK disamarkan. Simpan dan bagikan sesuai ketentuan kerahasiaan rekam medis.'
      : 'Kolom identitas disamarkan.',
  );

  return { nama, kolom, baris: terpilih, catatan: catatanLengkap, tersamarkan: !buka };
}

/** Ubah satu nilai menjadi teks untuk CSV dan Excel. */
export function nilaiKeTeks(nilai: BarisHasil[string]): string {
  if (nilai === null) return '';
  if (Array.isArray(nilai)) return nilai.join('; ');
  if (typeof nilai === 'boolean') return nilai ? 'ya' : 'tidak';
  return String(nilai);
}
