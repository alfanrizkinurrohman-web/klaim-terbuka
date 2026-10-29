import { muatHariLibur, muatKlaim } from '../../src/db/muat';
import type { BerkasHariLibur } from '../../src/db/muat';
import type { KoneksiKlaim } from '../../src/db/types';
import type { Klaim } from '../../src/parser/types';
import { mapUji } from '../helpers';

/** Berkas hari libur kosong, mencerminkan placeholder di data/hari-libur/. */
export const HARI_LIBUR_KOSONG: BerkasHariLibur = {
  tahun: 2026,
  status: 'placeholder',
  sumber: 'BELUM DIISI',
  hari_libur: [],
  cuti_bersama: [],
};

/** Berkas hari libur terisi, hanya untuk test. Bukan tanggal resmi. */
export function hariLiburUji(tanggal: string[]): BerkasHariLibur {
  return {
    tahun: 2026,
    status: 'terverifikasi',
    sumber: 'DATA UJI, BUKAN SKB',
    hari_libur: tanggal.map((t) => ({
      tanggal: t,
      keterangan: 'Hari libur uji',
      jenis: 'hari_libur' as const,
    })),
    cuti_bersama: [],
  };
}

/**
 * Isi ulang tabel klaim dan hari_libur pada koneksi yang sudah ada.
 * Memakai CREATE OR REPLACE, jadi aman dipanggil berulang antar-test.
 */
export async function isiTabel(
  koneksi: KoneksiKlaim,
  klaim: Klaim[],
  hariLibur: BerkasHariLibur = HARI_LIBUR_KOSONG,
): Promise<void> {
  await muatKlaim(koneksi, klaim, mapUji());
  await muatHariLibur(koneksi, [hariLibur]);
}

/** Nomor baris dari hasil sebuah aturan, untuk pembandingan yang ringkas. */
export function barisTemuan(baris: Array<Record<string, unknown>>): number[] {
  return baris.map((b) => Number(b['nomor_baris'])).sort((a, b) => a - b);
}
