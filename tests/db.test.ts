import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { hariLiburKosong, muatHariLibur, muatKlaim } from '../src/db/muat';
import { kolomTabelKlaim, literalSql } from '../src/db/skema';
import type { KoneksiKlaim } from '../src/db/types';
import { mapUji } from './helpers';
import { hariLiburUji, HARI_LIBUR_KOSONG, isiTabel } from './support/db';
import { buatKoneksiUji } from './support/duckdbNode';
import { klaimUji } from './support/klaim';

let koneksi: KoneksiKlaim;

beforeAll(async () => {
  koneksi = await buatKoneksiUji();
}, 60_000);

afterAll(async () => {
  await koneksi?.tutup();
});

describe('skema tabel klaim', () => {
  it('diturunkan dari column-map, bukan ditulis tangan', () => {
    const kolom = kolomTabelKlaim(mapUji()).map((k) => k.nama);
    // 2 kolom bawaan + 92 kolom berkas (C2 jadi 1) + 2 sub-field payor
    // + 3 sub-field coder + 19 kolom turunan.
    expect(kolom).toContain('nomor_baris');
    expect(kolom).toContain('berkas');
    expect(kolom).toContain('payor_kode');
    expect(kolom).toContain('coder_id');
    expect(kolom).toContain('cara_masuk');
    expect(new Set(kolom).size).toBe(kolom.length);
  });

  it('memakai tipe SQL yang sesuai', () => {
    const tipe = new Map(kolomTabelKlaim(mapUji()).map((k) => [k.nama, k.tipe]));
    expect(tipe.get('tanggal_masuk')).toBe('DATE');
    expect(tipe.get('tarif_rs')).toBe('BIGINT');
    expect(tipe.get('idrg_total_cost_weight')).toBe('DOUBLE');
    expect(tipe.get('diagnosis_inacbg')).toBe('VARCHAR[]');
    expect(tipe.get('kode_inacbg')).toBe('VARCHAR');
  });
});

describe('literal SQL', () => {
  it('menggandakan kutip tunggal', () => {
    expect(literalSql("RS D'Angelo")).toBe("'RS D''Angelo'");
  });

  it('mengubah kosong menjadi NULL', () => {
    expect(literalSql(null)).toBe('NULL');
    expect(literalSql(undefined)).toBe('NULL');
  });

  it('mengubah daftar kosong menjadi daftar bertipe, bukan NULL', () => {
    expect(literalSql([])).toBe('CAST([] AS VARCHAR[])');
  });

  it('menolak angka yang tidak terhingga', () => {
    expect(literalSql(Number.POSITIVE_INFINITY)).toBe('NULL');
    expect(literalSql(Number.NaN)).toBe('NULL');
  });
});

describe('pemuatan data', () => {
  it('memuat klaim dan mengembalikan tanggal sebagai teks', async () => {
    await isiTabel(koneksi, [klaimUji(2), klaimUji(3)]);
    const baris = await koneksi.jalankan(
      'SELECT nomor_baris, tanggal_masuk, tanggal_pulang, tanggal_lahir FROM klaim ORDER BY nomor_baris',
    );

    expect(baris).toHaveLength(2);
    expect(baris[0]?.['tanggal_masuk']).toBe('2026-06-01');
    expect(baris[0]?.['tanggal_pulang']).toBe('2026-06-03');
    expect(baris[0]?.['tanggal_lahir']).toBe('1986-03-14');
  });

  it('mengembalikan kolom daftar sebagai array', async () => {
    await isiTabel(koneksi, [
      klaimUji(2, { diagnosis_inacbg: ['A01.0', 'B02.1'], prosedur_inacbg: [] }),
    ]);
    const baris = await koneksi.jalankan(
      'SELECT diagnosis_inacbg, prosedur_inacbg FROM klaim',
    );

    expect(baris[0]?.['diagnosis_inacbg']).toEqual(['A01.0', 'B02.1']);
    expect(baris[0]?.['prosedur_inacbg']).toEqual([]);
  });

  it('menyimpan nilai teks yang memuat kutip tanpa merusak query', async () => {
    await isiTabel(koneksi, [klaimUji(2, { deskripsi_inacbg: "TINDAKAN 'KHUSUS'" })]);
    const baris = await koneksi.jalankan('SELECT deskripsi_inacbg FROM klaim');
    expect(baris[0]?.['deskripsi_inacbg']).toBe("TINDAKAN 'KHUSUS'");
  });

  it('memuat lebih dari satu batch', async () => {
    const banyak = Array.from({ length: 450 }, (_, i) => klaimUji(i + 2));
    await isiTabel(koneksi, banyak);
    const baris = await koneksi.jalankan('SELECT count(*) AS n FROM klaim');
    expect(baris[0]?.['n']).toBe(450);
  });

  it('mengembalikan hasil sum sebagai angka, bukan teks', async () => {
    // sum() atas BIGINT menjadi HUGEINT, yang di Arrow adalah Decimal dan
    // dirender toJSON sebagai string. Tanpa penanganan tipe, seluruh angka
    // ringkasan menjadi teks.
    await isiTabel(koneksi, [
      klaimUji(2, { tarif_rs: 1_000_000 }),
      klaimUji(3, { tarif_rs: 2_000_000 }),
    ]);
    const baris = await koneksi.jalankan('SELECT sum(tarif_rs) AS jumlah FROM klaim');
    expect(baris[0]?.['jumlah']).toBe(3_000_000);
    expect(typeof baris[0]?.['jumlah']).toBe('number');
  });

  it('membiarkan angka di luar jangkauan aman sebagai teks', async () => {
    await isiTabel(koneksi, [klaimUji(2)]);
    const baris = await koneksi.jalankan(
      "SELECT CAST('99999999999999999999' AS HUGEINT) AS besar FROM klaim",
    );
    // Lebih baik tampil apa adanya daripada kehilangan ketelitian tanpa disadari.
    expect(baris[0]?.['besar']).toBe('99999999999999999999');
  });

  it('tidak mengubah kode berangka nol di depan menjadi angka', async () => {
    await isiTabel(koneksi, [klaimUji(2, { kode_rs: '0000000', mrn: '0012345' })]);
    const baris = await koneksi.jalankan('SELECT kode_rs, mrn FROM klaim');
    expect(baris[0]?.['kode_rs']).toBe('0000000');
    expect(baris[0]?.['mrn']).toBe('0012345');
  });

  it('mengisi ulang tabel, bukan menumpuk', async () => {
    await isiTabel(koneksi, [klaimUji(2)]);
    await isiTabel(koneksi, [klaimUji(2), klaimUji(3)]);
    const baris = await koneksi.jalankan('SELECT count(*) AS n FROM klaim');
    expect(baris[0]?.['n']).toBe(2);
  });
});

describe('tabel hari libur', () => {
  it('tetap dibuat meski daftarnya kosong', async () => {
    await muatKlaim(koneksi, [klaimUji(2)], mapUji());
    await muatHariLibur(koneksi, [HARI_LIBUR_KOSONG]);
    expect(await hariLiburKosong(koneksi)).toBe(true);
  });

  it('terisi bila daftarnya ada', async () => {
    await muatHariLibur(koneksi, [hariLiburUji(['2026-06-02', '2026-06-03'])]);
    expect(await hariLiburKosong(koneksi)).toBe(false);

    const baris = await koneksi.jalankan(
      'SELECT tanggal, keterangan, jenis FROM hari_libur ORDER BY tanggal',
    );
    expect(baris).toHaveLength(2);
    expect(baris[0]?.['tanggal']).toBe('2026-06-02');
    expect(baris[0]?.['jenis']).toBe('hari_libur');
  });
});
