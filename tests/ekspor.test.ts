import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { PEMISAH_CSV, tabelKeCsv } from '../src/ekspor/csv';
import { siapkanTabel } from '../src/ekspor/tabel';
import type { KolomTabel } from '../src/ekspor/tabel';
import { capWaktu, namaBerkasAman } from '../src/ekspor/unduh';
import { alamatSel, namaLembarAman, tabelKeXlsx } from '../src/ekspor/xlsx';
import { mapUji } from './helpers';

const KOLOM: KolomTabel[] = [
  { nama: 'nomor_baris', label: 'Baris', format: 'angka' },
  { nama: 'nama_pasien', label: 'Nama pasien', identitas: true },
  { nama: 'mrn', label: 'No. RM', identitas: true },
  { nama: 'total_tarif', label: 'Total tarif', format: 'rupiah' },
  { nama: 'diagnosis_inacbg', label: 'Diagnosis', format: 'daftar' },
];

const BARIS = [
  {
    nomor_baris: 2,
    nama_pasien: 'SITI AMINAH',
    mrn: '0012345',
    total_tarif: 1_500_000,
    diagnosis_inacbg: ['A01.0', 'B02.1'],
  },
];

function tabel(bukaSamaran = false) {
  return siapkanTabel('uji', KOLOM, BARIS, mapUji(), ['Catatan uji'], { bukaSamaran });
}

describe('penyiapan tabel ekspor', () => {
  it('menyamarkan identitas secara bawaan', () => {
    const t = tabel();
    expect(t.tersamarkan).toBe(true);
    expect(t.baris[0]?.['nama_pasien']).toBe('S••• A•••');
    expect(t.baris[0]?.['mrn']).toBe('•••2345');
    expect(t.baris[0]?.['total_tarif']).toBe(1_500_000);
  });

  it('menyebut status penyamaran di catatan', () => {
    expect(tabel().catatan.join(' ')).toContain('disamarkan');
    expect(tabel(true).catatan.join(' ')).toContain('TIDAK disamarkan');
  });

  it('hanya mengambil kolom yang dilabeli', () => {
    const t = siapkanTabel('uji', KOLOM, [{ ...BARIS[0], rahasia: 'jangan ikut' }], mapUji());
    expect(t.baris[0]).not.toHaveProperty('rahasia');
  });
});

describe('ekspor CSV', () => {
  it('diawali BOM dan memakai CRLF', () => {
    const csv = tabelKeCsv(tabel());
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('\r\n');
  });

  it('memakai titik koma sebagai pemisah', () => {
    const csv = tabelKeCsv(tabel());
    const barisKepala = csv.split('\r\n').find((b) => b.startsWith('Baris'));
    expect(barisKepala?.split(PEMISAH_CSV)).toEqual([
      'Baris',
      'Nama pasien',
      'No. RM',
      'Total tarif',
      'Diagnosis',
    ]);
  });

  it('mengutip nilai yang memuat pemisah atau tanda kutip', () => {
    const t = siapkanTabel(
      'uji',
      [{ nama: 'catatan', label: 'Catatan' }],
      [{ catatan: 'ada; titik koma dan "kutip"' }],
      mapUji(),
      [],
    );
    const csv = tabelKeCsv(t);
    expect(csv).toContain('"ada; titik koma dan ""kutip"""');
  });

  it('menggabungkan daftar kode dengan titik koma dan spasi', () => {
    expect(tabelKeCsv(tabel())).toContain('A01.0; B02.1');
  });

  it('tidak memuat nilai identitas asli saat tersamarkan', () => {
    const csv = tabelKeCsv(tabel());
    expect(csv).not.toContain('SITI AMINAH');
    expect(csv).not.toContain('0012345');
  });
});

describe('ekspor Excel', () => {
  function bukaXlsx(bytes: Uint8Array): Record<string, string> {
    const isi = unzipSync(bytes);
    const teks = new TextDecoder();
    return Object.fromEntries(
      Object.entries(isi).map(([nama, data]) => [nama, teks.decode(data)]),
    );
  }

  it('menghasilkan arsip dengan bagian wajib OOXML', () => {
    const isi = bukaXlsx(tabelKeXlsx([tabel()]));
    expect(Object.keys(isi).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ]);
  });

  it('mendaftarkan setiap lembar di content types, workbook, dan rels', () => {
    const isi = bukaXlsx(tabelKeXlsx([tabel(), { ...tabel(), nama: 'lembar-kedua' }]));
    expect(isi['[Content_Types].xml']).toContain('/xl/worksheets/sheet2.xml');
    expect(isi['xl/workbook.xml']).toContain('name="lembar-kedua"');
    expect(isi['xl/workbook.xml']).toContain('r:id="rId2"');
    expect(isi['xl/_rels/workbook.xml.rels']).toContain('worksheets/sheet2.xml');
    expect(isi).toHaveProperty('xl/worksheets/sheet2.xml');
  });

  it('menulis angka sebagai angka dan teks sebagai inlineStr', () => {
    const sheet = bukaXlsx(tabelKeXlsx([tabel()]))['xl/worksheets/sheet1.xml'] ?? '';
    expect(sheet).toContain('<v>1500000</v>');
    expect(sheet).toContain('t="inlineStr"');
  });

  it('mempertahankan nol di depan pada kode yang berupa teks', () => {
    const t = siapkanTabel(
      'uji',
      [{ nama: 'kode_rs', label: 'Kode RS' }],
      [{ kode_rs: '0000000' }],
      mapUji(),
      [],
    );
    const sheet = bukaXlsx(tabelKeXlsx([t]))['xl/worksheets/sheet1.xml'] ?? '';
    expect(sheet).toContain('<t xml:space="preserve">0000000</t>');
    expect(sheet).not.toContain('<v>0</v>');
  });

  it('meloloskan karakter khusus XML', () => {
    const t = siapkanTabel(
      'uji',
      [{ nama: 'catatan', label: 'Catatan' }],
      [{ catatan: 'bedah & <jahit> "selesai"' }],
      mapUji(),
      [],
    );
    const sheet = bukaXlsx(tabelKeXlsx([t]))['xl/worksheets/sheet1.xml'] ?? '';
    expect(sheet).toContain('bedah &amp; &lt;jahit&gt; &quot;selesai&quot;');
  });

  it('membuang karakter kendali yang tidak sah di XML', () => {
    const t = siapkanTabel(
      'uji',
      [{ nama: 'catatan', label: 'Catatan' }],
      [{ catatan: 'sebelum\u0007sesudah' }],
      mapUji(),
      [],
    );
    const sheet = bukaXlsx(tabelKeXlsx([t]))['xl/worksheets/sheet1.xml'] ?? '';
    expect(sheet).toContain('sebelumsesudah');
  });

  it('tidak memuat identitas asli saat tersamarkan', () => {
    const isi = bukaXlsx(tabelKeXlsx([tabel()]));
    const semua = Object.values(isi).join('');
    expect(semua).not.toContain('SITI AMINAH');
    expect(semua).not.toContain('0012345');
  });

  it('menolak ekspor tanpa tabel', () => {
    expect(() => tabelKeXlsx([])).toThrow(/Tidak ada tabel/);
  });
});

describe('nama lembar dan alamat sel', () => {
  it('memotong nama lembar pada 31 karakter', () => {
    expect(namaLembarAman('a'.repeat(50))).toHaveLength(31);
  });

  it('mengganti karakter yang dilarang Excel', () => {
    expect(namaLembarAman('a/b\\c?d*e[f]g:h')).toBe('a-b-c-d-e-f-g-h');
  });

  it('membuat nama unik bila bentrok', () => {
    const dipakai = new Set(['temuan']);
    expect(namaLembarAman('temuan', dipakai)).toBe('temuan~2');
  });

  it('memberi nama pengganti bila kosong', () => {
    expect(namaLembarAman("'''")).toBe('Lembar');
  });

  it('menghitung alamat sel gaya A1', () => {
    expect(alamatSel(0, 1)).toBe('A1');
    expect(alamatSel(25, 3)).toBe('Z3');
    expect(alamatSel(26, 1)).toBe('AA1');
    expect(alamatSel(27, 10)).toBe('AB10');
  });
});

describe('nama berkas unduhan', () => {
  it('membuang karakter yang dilarang sistem berkas', () => {
    expect(namaBerkasAman('a/b\\c:d*e?f"g<h>i|j.csv')).toBe('a-b-c-d-e-f-g-h-i-j.csv');
  });

  it('membuat cap waktu yang bisa diurutkan', () => {
    expect(capWaktu(new Date(2026, 9, 29, 11, 5))).toBe('20261029-1105');
  });
});
