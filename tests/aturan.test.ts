import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { KoneksiKlaim } from '../src/db/types';
import { jalankanAturan, jalankanSemuaAturan } from '../src/rules/engine';
import type { Aturan } from '../src/rules/schema';
import { aturanDenganId, semuaAturan } from './support/aturan';
import { barisTemuan, hariLiburUji, isiTabel } from './support/db';
import { buatKoneksiUji } from './support/duckdbNode';
import { klaimUji, klaimUjiKonsisten } from './support/klaim';

let koneksi: KoneksiKlaim;

beforeAll(async () => {
  koneksi = await buatKoneksiUji();
}, 60_000);

afterAll(async () => {
  await koneksi?.tutup();
});

/** Jalankan satu aturan atas data yang diberikan dan kembalikan hasilnya. */
async function uji(
  idAturan: string,
  klaim: Parameters<typeof isiTabel>[1],
  opsi: { parameter?: Record<string, number | string>; hariLibur?: Parameters<typeof isiTabel>[2] } = {},
) {
  await isiTabel(koneksi, klaim, opsi.hariLibur);
  const aturan = aturanDenganId(idAturan);
  const hasil = await jalankanAturan(koneksi, aturan, {
    parameter: opsi.parameter ? { [idAturan]: opsi.parameter } : undefined,
  });
  expect(hasil.galat, `aturan ${idAturan} gagal dijalankan`).toBeNull();
  return hasil;
}

describe('1. duplikasi-klaim', () => {
  it('memicu pada klaim dengan No. RM, tanggal masuk, dan jenis rawat yang sama', async () => {
    const hasil = await uji('duplikasi-klaim', [
      klaimUji(2, { mrn: '555001' }),
      klaimUji(3, { mrn: '555001' }),
      klaimUji(4, { mrn: '555002' }),
    ]);
    expect(barisTemuan(hasil.baris)).toEqual([2, 3]);
    expect(hasil.baris[0]?.['jumlah_klaim']).toBe(2);
    // Tanggal harus kembali sebagai teks, bukan angka epoch.
    expect(hasil.baris[0]?.['tanggal_masuk']).toBe('2026-06-01');
  });

  it('tidak memicu bila jenis rawat berbeda pada tanggal yang sama', async () => {
    const hasil = await uji('duplikasi-klaim', [
      klaimUji(2, { mrn: '555001', ptd: '1' }),
      klaimUji(3, { mrn: '555001', ptd: '2' }),
    ]);
    expect(hasil.baris).toEqual([]);
  });

  it('tidak memicu bila tanggal masuk berbeda', async () => {
    const hasil = await uji('duplikasi-klaim', [
      klaimUji(2, { mrn: '555001', tanggal_masuk: '2026-06-01' }),
      klaimUji(3, { mrn: '555001', tanggal_masuk: '2026-06-02' }),
    ]);
    expect(hasil.baris).toEqual([]);
  });

  it('tidak memicu bila No. RM kosong', async () => {
    const hasil = await uji('duplikasi-klaim', [
      klaimUji(2, { mrn: null }),
      klaimUji(3, { mrn: null }),
    ]);
    expect(hasil.baris).toEqual([]);
  });
});

describe('2. rawat-jalan-hari-libur', () => {
  // 7 Juni 2026 = Minggu, 1 Juni 2026 = Senin.
  const rajal = (baris: number, tanggal: string) =>
    klaimUji(baris, {
      ptd: '2',
      kelas_rawat: '3',
      tanggal_masuk: tanggal,
      tanggal_pulang: tanggal,
      los: 1,
    });

  it('memicu pada rawat jalan hari Minggu', async () => {
    const hasil = await uji('rawat-jalan-hari-libur', [
      rajal(2, '2026-06-07'),
      rajal(3, '2026-06-01'),
    ]);
    expect(barisTemuan(hasil.baris)).toEqual([2]);
    expect(hasil.baris[0]?.['nama_hari']).toBe('Sunday');
    expect(hasil.baris[0]?.['alasan']).toBe('Hari Minggu');
  });

  it('tidak memicu pada rawat inap hari Minggu', async () => {
    const hasil = await uji('rawat-jalan-hari-libur', [
      klaimUji(2, { ptd: '1', tanggal_masuk: '2026-06-07' }),
    ]);
    expect(hasil.baris).toEqual([]);
  });

  it('memicu pada hari libur yang terdaftar meski bukan hari Minggu', async () => {
    const hasil = await uji(
      'rawat-jalan-hari-libur',
      [rajal(2, '2026-06-02'), rajal(3, '2026-06-03')],
      { hariLibur: hariLiburUji(['2026-06-02']) },
    );
    expect(barisTemuan(hasil.baris)).toEqual([2]);
    expect(hasil.baris[0]?.['alasan']).toBe('Hari libur uji');
  });

  it('memberi catatan bahwa daftar hari libur belum diisi', async () => {
    const hasil = await uji('rawat-jalan-hari-libur', [rajal(2, '2026-06-07')]);
    expect(hasil.catatan.join(' ')).toContain('hari libur');
  });

  it('tidak memberi catatan itu bila daftar hari libur sudah terisi', async () => {
    const hasil = await uji('rawat-jalan-hari-libur', [rajal(2, '2026-06-07')], {
      hariLibur: hariLiburUji(['2026-06-02']),
    });
    expect(hasil.catatan.join(' ')).not.toContain('belum diisi');
  });
});

describe('3. rawat-inap-berulang', () => {
  const episode = (baris: number, masuk: string, pulang: string, mrn = '555001') =>
    klaimUji(baris, { mrn, ptd: '1', tanggal_masuk: masuk, tanggal_pulang: pulang });

  it('memicu pada readmisi dalam 30 hari', async () => {
    const hasil = await uji('rawat-inap-berulang', [
      episode(2, '2026-06-01', '2026-06-03'),
      episode(3, '2026-06-20', '2026-06-22'),
    ]);
    expect(barisTemuan(hasil.baris)).toEqual([3]);
    expect(hasil.baris[0]?.['jarak_hari']).toBe(17);
    expect(hasil.baris[0]?.['pulang_episode_sebelumnya']).toBe('2026-06-03');
  });

  it('tidak memicu bila jarak melampaui ambang', async () => {
    const hasil = await uji('rawat-inap-berulang', [
      episode(2, '2026-06-01', '2026-06-03'),
      episode(3, '2026-08-01', '2026-08-03'),
    ]);
    expect(hasil.baris).toEqual([]);
  });

  it('menghormati ambang_hari yang diperketat', async () => {
    const klaim = [episode(2, '2026-06-01', '2026-06-03'), episode(3, '2026-06-20', '2026-06-22')];
    const ketat = await uji('rawat-inap-berulang', klaim, { parameter: { ambang_hari: 7 } });
    expect(ketat.baris).toEqual([]);
    expect(ketat.parameterTerpakai['ambang_hari']).toBe(7);

    const longgar = await uji('rawat-inap-berulang', klaim, { parameter: { ambang_hari: 60 } });
    expect(barisTemuan(longgar.baris)).toEqual([3]);
  });

  it('tidak memicu pada pasien yang berbeda', async () => {
    const hasil = await uji('rawat-inap-berulang', [
      episode(2, '2026-06-01', '2026-06-03', '555001'),
      episode(3, '2026-06-20', '2026-06-22', '555002'),
    ]);
    expect(hasil.baris).toEqual([]);
  });

  it('tidak memicu pada rawat jalan', async () => {
    const hasil = await uji('rawat-inap-berulang', [
      klaimUji(2, { mrn: '555001', ptd: '2', tanggal_masuk: '2026-06-01', tanggal_pulang: '2026-06-01' }),
      klaimUji(3, { mrn: '555001', ptd: '2', tanggal_masuk: '2026-06-10', tanggal_pulang: '2026-06-10' }),
    ]);
    expect(hasil.baris).toEqual([]);
  });

  it('selalu berstatus draft dan menyebut perlu validasi koder', async () => {
    const hasil = await uji('rawat-inap-berulang', [episode(2, '2026-06-01', '2026-06-03')]);
    expect(hasil.aturan.status).toBe('draft');
    expect(hasil.aturan.sumber_regulasi).toBeNull();
    expect(hasil.catatan.join(' ')).toContain('perlu validasi koder');
  });
});

describe('4. icu-tidak-konsisten', () => {
  /** Klaim ICU yang wajar: biaya perawatan intensif ada di komponen kamar. */
  const icuWajar = (baris: number, ubah: Record<string, unknown> = {}) =>
    klaimUji(baris, {
      icu_indikator: '1',
      icu_los: 2,
      komp_rawat_intensif: 0,
      komp_kamar_akomodasi: 9_000_000,
      ...(ubah as Record<string, never>),
    });

  it('TIDAK memicu bila berkas memang tidak memakai komponen rawat intensif', async () => {
    // Inilah pokok perbaikannya: rumusan lama memicu pada seluruh kasus ICU
    // di rumah sakit yang membukukan biaya ICU di komponen kamar.
    const hasil = await uji('icu-tidak-konsisten', [
      icuWajar(2),
      icuWajar(3),
      klaimUji(4),
    ]);
    expect(hasil.baris).toEqual([]);
  });

  it('memicu bila berkas memakai komponen rawat intensif pada klaim lain', async () => {
    const hasil = await uji('icu-tidak-konsisten', [
      icuWajar(2),
      klaimUji(3, { icu_indikator: '1', icu_los: 2, komp_rawat_intensif: 4_500_000 }),
    ]);
    expect(barisTemuan(hasil.baris)).toEqual([2]);
    expect(String(hasil.baris[0]?.['alasan'])).toContain('padahal berkas ini memakainya');
  });

  it('memicu pada klaim rawat jalan yang indikator ICU-nya terisi', async () => {
    const hasil = await uji('icu-tidak-konsisten', [
      klaimUji(2, {
        ptd: '2',
        los: 1,
        tanggal_pulang: '2026-06-01',
        icu_indikator: '1',
        icu_los: 1,
        komp_kamar_akomodasi: 485_000,
      }),
      icuWajar(3),
    ]);
    expect(barisTemuan(hasil.baris)).toEqual([2]);
    expect(hasil.baris[0]?.['alasan']).toBe('Klaim rawat jalan tetapi indikator ICU terisi');
  });

  it('memicu bila indikator ICU terisi tetapi lama rawat ICU nol', async () => {
    const hasil = await uji('icu-tidak-konsisten', [icuWajar(2, { icu_los: 0 })]);
    expect(hasil.baris[0]?.['alasan']).toBe('Indikator ICU terisi tetapi lama rawat ICU nol');
  });

  it('memicu bila lama rawat ICU melebihi lama rawat seluruhnya', async () => {
    const hasil = await uji('icu-tidak-konsisten', [icuWajar(2, { los: 2, icu_los: 5 })]);
    expect(hasil.baris[0]?.['alasan']).toBe('Lama rawat ICU melebihi lama rawat seluruhnya');
  });

  it('memicu bila lama rawat ICU terisi tetapi indikatornya tidak', async () => {
    const hasil = await uji('icu-tidak-konsisten', [
      klaimUji(2, { icu_indikator: '0', icu_los: 3 }),
    ]);
    expect(hasil.baris[0]?.['alasan']).toBe(
      'Lama rawat ICU terisi tetapi indikator ICU tidak',
    );
  });

  it('memicu bila jam ventilator terisi tetapi indikator ICU tidak', async () => {
    const hasil = await uji('icu-tidak-konsisten', [
      klaimUji(2, { icu_indikator: '0', icu_los: 0, jam_ventilator: 40 }),
    ]);
    expect(hasil.baris[0]?.['alasan']).toBe(
      'Jam ventilator terisi tetapi indikator ICU tidak',
    );
  });

  it('memicu bila tidak ada biaya rawat intensif maupun biaya kamar', async () => {
    const hasil = await uji('icu-tidak-konsisten', [
      icuWajar(2, { komp_kamar_akomodasi: 0 }),
    ]);
    expect(String(hasil.baris[0]?.['alasan'])).toContain('tidak ada biaya rawat intensif');
  });

  it('tidak memicu pada klaim ICU yang seluruh isiannya cocok', async () => {
    const hasil = await uji('icu-tidak-konsisten', [
      klaimUji(2, {
        icu_indikator: '1',
        icu_los: 2,
        jam_ventilator: 30,
        komp_rawat_intensif: 4_500_000,
      }),
      klaimUji(3),
    ]);
    expect(hasil.baris).toEqual([]);
  });

  it('menampilkan biaya kamar dan rawat intensif agar bisa dipilah', async () => {
    const hasil = await uji('icu-tidak-konsisten', [
      icuWajar(2, { komp_kamar_akomodasi: 0, jam_ventilator: 30 }),
    ]);
    expect(hasil.baris[0]?.['komp_kamar_akomodasi']).toBe(0);
    expect(hasil.baris[0]?.['komp_rawat_intensif']).toBe(0);
    expect(hasil.baris[0]?.['jam_ventilator']).toBe(30);
  });
});

describe('5. rawat-inap-los-1-hari', () => {
  it('memicu pada rawat inap dengan LOS 1 hari', async () => {
    const hasil = await uji('rawat-inap-los-1-hari', [
      klaimUji(2, { ptd: '1', los: 1, tanggal_pulang: '2026-06-01' }),
      klaimUji(3, { ptd: '1', los: 3 }),
    ]);
    expect(barisTemuan(hasil.baris)).toEqual([2]);
  });

  it('tidak memicu pada rawat jalan dengan LOS 1 hari', async () => {
    const hasil = await uji('rawat-inap-los-1-hari', [
      klaimUji(2, { ptd: '2', los: 1, tanggal_pulang: '2026-06-01' }),
    ]);
    expect(hasil.baris).toEqual([]);
  });

  it('menampilkan cara pulang agar kasus meninggal dan pulang paksa terlihat', async () => {
    const hasil = await uji('rawat-inap-los-1-hari', [
      klaimUji(2, { ptd: '1', los: 1, tanggal_pulang: '2026-06-01', cara_pulang: '4' }),
    ]);
    expect(hasil.baris[0]?.['cara_pulang']).toBe('4');
  });
});

describe('6. rawat-jalan-kelas-rawat', () => {
  it('memicu pada rawat jalan dengan kelas rawat bukan 3', async () => {
    const hasil = await uji('rawat-jalan-kelas-rawat', [
      klaimUji(2, { ptd: '2', kelas_rawat: '1' }),
      klaimUji(3, { ptd: '2', kelas_rawat: '2' }),
      klaimUji(4, { ptd: '2', kelas_rawat: '3' }),
    ]);
    expect(barisTemuan(hasil.baris)).toEqual([2, 3]);
  });

  it('tidak memicu pada rawat inap kelas 1', async () => {
    const hasil = await uji('rawat-jalan-kelas-rawat', [
      klaimUji(2, { ptd: '1', kelas_rawat: '1' }),
    ]);
    expect(hasil.baris).toEqual([]);
  });

  it('tidak memicu bila kelas rawat kosong', async () => {
    const hasil = await uji('rawat-jalan-kelas-rawat', [
      klaimUji(2, { ptd: '2', kelas_rawat: null }),
    ]);
    expect(hasil.baris).toEqual([]);
  });
});

describe('7. komponen-tarif-tidak-wajar', () => {
  it('memicu pada komponen bernilai Rp5', async () => {
    const hasil = await uji('komponen-tarif-tidak-wajar', [
      klaimUjiKonsisten(2, { komp_pelayanan_darah: 5 }),
      klaimUjiKonsisten(3, { komp_pelayanan_darah: 0 }),
      klaimUjiKonsisten(4, { komp_pelayanan_darah: 360_000 }),
    ]);
    expect(barisTemuan(hasil.baris)).toEqual([2]);
    expect(hasil.baris[0]?.['nama_komponen']).toBe('komp_pelayanan_darah');
    expect(hasil.baris[0]?.['nilai']).toBe(5);
  });

  it('melaporkan satu baris per komponen yang bermasalah', async () => {
    const hasil = await uji('komponen-tarif-tidak-wajar', [
      klaimUjiKonsisten(2, { komp_pelayanan_darah: 5, komp_sewa_alat: 12 }),
    ]);
    expect(hasil.baris).toHaveLength(2);
    expect(hasil.baris.map((b) => b['nama_komponen']).sort()).toEqual([
      'komp_pelayanan_darah',
      'komp_sewa_alat',
    ]);
  });

  it('menghormati ambang_rupiah', async () => {
    const klaim = [klaimUjiKonsisten(2, { komp_pelayanan_darah: 500 })];

    const bawaan = await uji('komponen-tarif-tidak-wajar', klaim);
    expect(barisTemuan(bawaan.baris)).toEqual([2]);

    const ketat = await uji('komponen-tarif-tidak-wajar', klaim, {
      parameter: { ambang_rupiah: 100 },
    });
    expect(ketat.baris).toEqual([]);
  });

  it('tidak memicu pada komponen yang nilainya wajar', async () => {
    const hasil = await uji('komponen-tarif-tidak-wajar', [klaimUjiKonsisten(2)]);
    expect(hasil.baris).toEqual([]);
  });
});

describe('8. perbedaan-daftar-diagnosis', () => {
  it('memicu bila daftar diagnosis berbeda', async () => {
    const hasil = await uji('perbedaan-daftar-diagnosis', [
      klaimUji(2, { diagnosis_inacbg: ['C41.1'], diagnosis_idrg: ['C41.19'] }),
      klaimUji(3, { diagnosis_inacbg: ['A01.0'], diagnosis_idrg: ['A01.0'] }),
    ]);
    expect(barisTemuan(hasil.baris)).toEqual([2]);
    expect(hasil.baris[0]?.['daftar_diagnosis_inacbg']).toBe('C41.1');
    expect(hasil.baris[0]?.['daftar_diagnosis_idrg']).toBe('C41.19');
  });

  it('tidak memicu bila hanya urutannya berbeda', async () => {
    const hasil = await uji('perbedaan-daftar-diagnosis', [
      klaimUji(2, {
        diagnosis_inacbg: ['I95.0', 'C41.1'],
        diagnosis_idrg: ['C41.1', 'I95.0'],
      }),
    ]);
    expect(hasil.baris).toEqual([]);
  });

  it('menandai jumlah diagnosis yang tidak sama', async () => {
    const hasil = await uji('perbedaan-daftar-diagnosis', [
      klaimUji(2, { diagnosis_inacbg: ['A01.0', 'B02.1'], diagnosis_idrg: ['A01.0'] }),
    ]);
    expect(hasil.baris[0]?.['jumlah_diagnosis_inacbg']).toBe(2);
    expect(hasil.baris[0]?.['jumlah_diagnosis_idrg']).toBe(1);
  });

  it('bertingkat informasi, bukan temuan kesalahan', () => {
    expect(aturanDenganId('perbedaan-daftar-diagnosis').tingkat).toBe('informasi');
  });
});

describe('penjagaan engine', () => {
  it('menjalankan kedelapan aturan tanpa galat SQL', async () => {
    await isiTabel(koneksi, [
      klaimUjiKonsisten(2),
      klaimUjiKonsisten(3, { ptd: '2', kelas_rawat: '3', los: 1, tanggal_pulang: '2026-06-01' }),
    ]);
    const hasil = await jalankanSemuaAturan(koneksi, semuaAturan());

    expect(hasil).toHaveLength(8);
    for (const h of hasil) {
      expect(h.galat, `aturan ${h.aturan.id}`).toBeNull();
    }
  });

  it('menolak query pengubah data meski lolos skema', async () => {
    // Lapis kedua: aturan dirakit langsung tanpa melewati validasi skema.
    await isiTabel(koneksi, [klaimUji(2), klaimUji(3)]);
    const jahat = {
      id: 'uji-jahat',
      judul: 'Uji',
      kategori: 'uji',
      status: 'draft',
      tingkat: 'temuan',
      deskripsi: 'uji',
      sumber_regulasi: null,
      query: 'DELETE FROM klaim',
      kolom_output: [{ nama: 'nomor_baris', label: 'Baris', identitas: false, format: 'angka' }],
      bukti_yang_perlu_diperiksa: ['uji'],
      catatan_etika: 'uji',
      parameter: [],
      butuh_hari_libur: false,
    } as unknown as Aturan;

    const hasil = await jalankanAturan(koneksi, jahat, {});
    expect(hasil.galat).not.toBeNull();

    const sisa = await koneksi.jalankan('SELECT count(*) AS n FROM klaim');
    expect(sisa[0]?.['n'], 'data tidak boleh terhapus').toBe(2);
  });

  it('memotong hasil pada batas baris dan menandainya', async () => {
    const banyak = Array.from({ length: 12 }, (_, i) => klaimUji(i + 2, { mrn: '555001' }));
    await isiTabel(koneksi, banyak);
    const hasil = await jalankanAturan(koneksi, aturanDenganId('duplikasi-klaim'), {
      batasBaris: 5,
    });

    expect(hasil.jumlah).toBe(12);
    expect(hasil.baris).toHaveLength(5);
    expect(hasil.terpotong).toBe(true);
  });

  it('melaporkan galat SQL sebagai hasil, bukan melempar', async () => {
    await isiTabel(koneksi, [klaimUji(2)]);
    const rusak = {
      ...aturanDenganId('duplikasi-klaim'),
      query: 'SELECT kolom_yang_tidak_ada FROM klaim',
    };
    const hasil = await jalankanAturan(koneksi, rusak, {});
    expect(hasil.galat).toBeTruthy();
    expect(hasil.baris).toEqual([]);
  });
});
