/**
 * Pemuatan hasil parsing ke tabel DuckDB.
 *
 * Data dimasukkan lewat pernyataan INSERT bernilai literal, bukan berkas
 * perantara, supaya tidak ada data klaim yang pernah menyentuh penyimpanan di
 * luar memori.
 */
import type { ColumnMap } from '../parser/columnMap';
import type { Klaim } from '../parser/types';
import { ddlTabelKlaim, DDL_HARI_LIBUR, kolomTabelKlaim, literalSql } from './skema';
import type { KoneksiKlaim } from './types';

/** Jumlah baris per pernyataan INSERT. */
const UKURAN_BATCH = 200;

export interface HariLibur {
  tanggal: string;
  keterangan: string;
  jenis: 'hari_libur' | 'cuti_bersama';
}

export interface BerkasHariLibur {
  tahun: number;
  status: 'placeholder' | 'terverifikasi';
  sumber: string;
  catatan?: string;
  hari_libur: HariLibur[];
  cuti_bersama: HariLibur[];
}

/** Buat tabel dan masukkan seluruh klaim. */
export async function muatKlaim(
  koneksi: KoneksiKlaim,
  klaim: Klaim[],
  map: ColumnMap,
): Promise<void> {
  await koneksi.jalankanInternal(ddlTabelKlaim(map));

  const kolom = kolomTabelKlaim(map);
  const daftarKolom = kolom.map((k) => `"${k.nama}"`).join(', ');

  for (let i = 0; i < klaim.length; i += UKURAN_BATCH) {
    const batch = klaim.slice(i, i + UKURAN_BATCH);
    const nilai = batch
      .map((baris) => `(${kolom.map((k) => literalSql(baris[k.nama])).join(', ')})`)
      .join(',\n');
    await koneksi.jalankanInternal(`INSERT INTO klaim (${daftarKolom}) VALUES\n${nilai}`);
  }
}

/**
 * Buat tabel `hari_libur`. Tabel tetap dibuat meski kosong, supaya aturan yang
 * menjoinnya tidak gagal — hanya saja tidak ada tanggal libur yang cocok.
 */
export async function muatHariLibur(
  koneksi: KoneksiKlaim,
  berkas: BerkasHariLibur[],
): Promise<void> {
  await koneksi.jalankanInternal(DDL_HARI_LIBUR);

  const semua = berkas.flatMap((b) => [
    ...b.hari_libur.map((h) => ({ ...h, jenis: 'hari_libur' as const })),
    ...b.cuti_bersama.map((h) => ({ ...h, jenis: 'cuti_bersama' as const })),
  ]);
  if (semua.length === 0) return;

  const nilai = semua
    .map(
      (h) =>
        `(${literalSql(h.tanggal)}, ${literalSql(h.keterangan)}, ${literalSql(h.jenis)})`,
    )
    .join(',\n');
  await koneksi.jalankanInternal(
    `INSERT INTO hari_libur ("tanggal", "keterangan", "jenis") VALUES\n${nilai}`,
  );
}

/** True bila belum ada satu pun tanggal libur yang dimuat. */
export async function hariLiburKosong(koneksi: KoneksiKlaim): Promise<boolean> {
  const hasil = await koneksi.jalankan('SELECT count(*) AS n FROM hari_libur');
  return Number(hasil[0]?.['n'] ?? 0) === 0;
}
