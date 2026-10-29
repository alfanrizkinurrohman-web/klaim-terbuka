import { zipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { aturan as aturanBawaan, berkasAturan, columnMap, hariLiburMasihPlaceholder } from '../src/app/aset';
import { hitungTingkat, jalankanAudit, kelompokkanPeringatan } from '../src/app/pipeline';
import { bongkarBerkas } from '../src/app/zip';
import type { BerkasMasuk } from '../src/app/zip';
import type { KoneksiKlaim } from '../src/db/types';
import { buatBerkasSintetis, keBytes } from './fixtures/generator';
import { buatKoneksiUji } from './support/duckdbNode';

let koneksi: KoneksiKlaim;

beforeAll(async () => {
  koneksi = await buatKoneksiUji();
}, 60_000);

afterAll(async () => {
  await koneksi?.tutup();
});

function berkasSintetis(jumlah = 12, benih = 31): BerkasMasuk {
  const berkas = buatBerkasSintetis(columnMap(), { jumlah, benih });
  return { nama: 'RS0000000_20260831_ranap.TXT', bytes: keBytes(berkas.teks) };
}

describe('aset yang dibundel', () => {
  it('memuat column-map yang sama dengan yang dipakai parser', () => {
    expect(columnMap().kolom).toHaveLength(93);
  });

  it('memuat kedelapan berkas aturan dari folder rules/', () => {
    expect(berkasAturan()).toHaveLength(8);
    expect(aturanBawaan().ditolak).toEqual([]);
    expect(aturanBawaan().aturan).toHaveLength(8);
  });

  it('memberi jalur aturan yang bisa dibaca manusia', () => {
    const jalur = berkasAturan().map((b) => b.jalur);
    expect(jalur).toContain('rules/duplikasi/duplikasi-klaim.yaml');
  });

  it('melaporkan daftar hari libur masih placeholder', () => {
    expect(hariLiburMasihPlaceholder()).toBe(true);
  });
});

describe('pembongkaran berkas masuk', () => {
  it('melewatkan berkas TXT apa adanya', () => {
    const hasil = bongkarBerkas([berkasSintetis()]);
    expect(hasil.berkas).toHaveLength(1);
    expect(hasil.peringatan).toEqual([]);
  });

  it('membongkar ZIP dan menandai asal berkasnya', () => {
    const txt = berkasSintetis(3, 32);
    const zip = zipSync({ 'ekspor/RS_20260831_ranap.TXT': txt.bytes });
    const hasil = bongkarBerkas([{ nama: 'kiriman.ZIP', bytes: zip }]);

    expect(hasil.berkas).toHaveLength(1);
    expect(hasil.berkas[0]?.nama).toBe('kiriman.ZIP:RS_20260831_ranap.TXT');
    expect(hasil.peringatan).toEqual([]);
  });

  it('membongkar beberapa TXT dari satu ZIP', () => {
    const zip = zipSync({
      'a.TXT': berkasSintetis(2, 33).bytes,
      'b.TXT': berkasSintetis(2, 34).bytes,
      'catatan.pdf': new Uint8Array([1, 2, 3]),
    });
    const hasil = bongkarBerkas([{ nama: 'kiriman.zip', bytes: zip }]);
    expect(hasil.berkas.map((b) => b.nama)).toEqual(['kiriman.zip:a.TXT', 'kiriman.zip:b.TXT']);
  });

  it('melaporkan ZIP tanpa berkas TXT', () => {
    const zip = zipSync({ 'catatan.pdf': new Uint8Array([1, 2, 3]) });
    const hasil = bongkarBerkas([{ nama: 'kiriman.zip', bytes: zip }]);
    expect(hasil.berkas).toEqual([]);
    expect(hasil.peringatan[0]?.kode).toBe('ZIP_TANPA_TXT');
  });

  it('melaporkan ZIP rusak tanpa melempar galat', () => {
    const rusak = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    const hasil = bongkarBerkas([{ nama: 'rusak.zip', bytes: rusak }]);
    expect(hasil.berkas).toEqual([]);
    expect(hasil.peringatan[0]?.kode).toBe('ZIP_RUSAK');
  });

  it('mengenali ZIP dari isinya meski berekstensi lain', () => {
    const zip = zipSync({ 'a.TXT': berkasSintetis(2, 35).bytes });
    const hasil = bongkarBerkas([{ nama: 'kiriman.bin', bytes: zip }]);
    expect(hasil.berkas).toHaveLength(1);
  });

  it('memperingatkan berkas yang bukan TXT maupun ZIP tetapi tetap mencobanya', () => {
    const hasil = bongkarBerkas([{ nama: 'data.csv', bytes: new Uint8Array([65, 66]) }]);
    expect(hasil.peringatan[0]?.kode).toBe('BUKAN_TXT');
    expect(hasil.berkas).toHaveLength(1);
  });
});

describe('alur audit lengkap', () => {
  it('berjalan dari berkas sampai temuan dan ringkasan', async () => {
    const tahap: string[] = [];
    const hasil = await jalankanAudit([berkasSintetis(20, 36)], koneksi, {
      lapor: (t) => tahap.push(t),
    });

    expect(hasil.jumlahKlaim).toBe(20);
    expect(hasil.ringkasanBerkasParsing).toHaveLength(1);
    expect(hasil.temuan).toHaveLength(8);
    expect(hasil.aturanDitolak).toEqual([]);
    expect(hasil.ringkasanBerkas).toHaveLength(1);
    expect(hasil.ringkasanDpjp.length).toBeGreaterThan(0);
    expect(hasil.klaim).toHaveLength(20);
    expect(hasil.hariLiburMasihPlaceholder).toBe(true);
    expect(tahap.length).toBeGreaterThan(3);

    for (const t of hasil.temuan) {
      expect(t.galat, `aturan ${t.aturan.id}`).toBeNull();
    }
  });

  it('tidak melanggar relasi struktural pada data sintetis yang sehat', async () => {
    const hasil = await jalankanAudit([berkasSintetis(25, 37)], koneksi);
    expect(hasil.peringatanRelasi).toEqual([]);
    expect(hitungTingkat(hasil.peringatanParser).galat).toBe(0);
  });

  it('menggabungkan beberapa berkas dalam satu audit', async () => {
    const hasil = await jalankanAudit(
      [
        { ...berkasSintetis(5, 38), nama: 'a.TXT' },
        { ...berkasSintetis(7, 39), nama: 'b.TXT' },
      ],
      koneksi,
    );

    expect(hasil.jumlahKlaim).toBe(12);
    expect(hasil.ringkasanBerkas).toHaveLength(2);
    expect(hasil.ringkasanBerkas.map((b) => b['berkas'])).toEqual(['a.TXT', 'b.TXT']);
  });

  it('meneruskan parameter aturan', async () => {
    const hasil = await jalankanAudit([berkasSintetis(20, 40)], koneksi, {
      parameter: { 'rawat-inap-berulang': { ambang_hari: 3 } },
    });
    const readmisi = hasil.temuan.find((t) => t.aturan.id === 'rawat-inap-berulang');
    expect(readmisi?.parameterTerpakai['ambang_hari']).toBe(3);
  });

  it('menangani berkas yang gagal dibaca tanpa melempar galat', async () => {
    const hasil = await jalankanAudit(
      [{ nama: 'bukan-eklaim.TXT', bytes: new TextEncoder().encode('satu,dua,tiga\r\n1,2,3\r\n') }],
      koneksi,
    );

    expect(hasil.jumlahKlaim).toBe(0);
    expect(hasil.temuan).toEqual([]);
    expect(kelompokkanPeringatan(hasil.peringatanParser).map((p) => p.kode)).toContain(
      'HEADER_TANPA_PEMISAH',
    );
  });

  it('memproses berkas di dalam ZIP', async () => {
    const txt = berkasSintetis(6, 41);
    const zip = zipSync({ 'ekspor/data.TXT': txt.bytes });
    const hasil = await jalankanAudit([{ nama: 'kiriman.zip', bytes: zip }], koneksi);

    expect(hasil.jumlahKlaim).toBe(6);
    expect(hasil.klaim[0]?.berkas).toBe('kiriman.zip:data.TXT');
  });
});

describe('pengelompokan peringatan', () => {
  it('menghitung per kode dan menyimpan contoh baris', () => {
    const kelompok = kelompokkanPeringatan([
      { kode: 'A', tingkat: 'peringatan', baris: 2, pesan: 'pesan a' },
      { kode: 'A', tingkat: 'peringatan', baris: 3, pesan: 'pesan a' },
      { kode: 'B', tingkat: 'galat', baris: 4, pesan: 'pesan b' },
    ]);

    // Galat didahulukan.
    expect(kelompok[0]?.kode).toBe('B');
    const a = kelompok.find((k) => k.kode === 'A');
    expect(a?.jumlah).toBe(2);
    expect(a?.barisContoh).toEqual([2, 3]);
  });

  it('membatasi contoh baris pada 10', () => {
    const banyak = Array.from({ length: 25 }, (_, i) => ({
      kode: 'A',
      tingkat: 'peringatan' as const,
      baris: i + 2,
      pesan: 'pesan',
    }));
    const kelompok = kelompokkanPeringatan(banyak);
    expect(kelompok[0]?.jumlah).toBe(25);
    expect(kelompok[0]?.barisContoh).toHaveLength(10);
  });
});
