import { describe, expect, it } from 'vitest';

import { parseEklaim } from '../src/parser/parseEklaim';
import { buatBerkasSintetis, keBytes } from './fixtures/generator';
import { kode, mapUji, padaBaris } from './helpers';

const map = mapUji();

function parse(teks: string, encoding: 'ascii' | 'utf8' | 'utf16le' = 'ascii') {
  return parseEklaim(keBytes(teks, encoding), map, { namaBerkas: 'uji.TXT' });
}

describe('parser berkas sehat', () => {
  const berkas = buatBerkasSintetis(map, { jumlah: 20, benih: 1 });
  const hasil = parse(berkas.teks);

  it('membaca seluruh baris tanpa galat', () => {
    expect(hasil.ringkasan.barisTerparse).toBe(20);
    expect(hasil.ringkasan.barisGagal).toBe(0);
    expect(hasil.peringatan.filter((p) => p.tingkat === 'galat')).toEqual([]);
  });

  it('memakai nama kolom baku, bukan nama kolom E-Klaim', () => {
    const klaim = hasil.klaim[0];
    expect(klaim).toBeDefined();
    expect(klaim).toHaveProperty('tanggal_masuk');
    expect(klaim).toHaveProperty('tarif_rs');
    expect(klaim).not.toHaveProperty('ADMISSION_DATE');
    expect(klaim).not.toHaveProperty('TARIF_RS');
  });

  it('menormalkan tanggal DD/MM/YYYY menjadi YYYY-MM-DD', () => {
    for (const k of hasil.klaim) {
      expect(k['tanggal_masuk']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(k['tanggal_pulang']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('menormalkan daftar kode kosong dari "-" maupun "" menjadi daftar kosong', () => {
    const tanpaProsedur = hasil.klaim.filter((k) => (k['prosedur_inacbg'] as string[]).length === 0);
    expect(tanpaProsedur.length).toBeGreaterThan(0);
    for (const k of tanpaProsedur) {
      expect(k['prosedur_inacbg']).toEqual([]);
      expect(k['prosedur_idrg']).toEqual([]);
    }
  });

  it('menjadikan kode pertama sebagai kode utama', () => {
    const k = hasil.klaim.find((x) => (x['diagnosis_inacbg'] as string[]).length > 1);
    expect(k).toBeDefined();
    const daftar = k?.['diagnosis_inacbg'] as string[];
    expect(daftar[0]).toMatch(/^A\d{2}\.\d$/);
  });

  it('mengubah "None" pada kolom special CMG menjadi kosong', () => {
    for (const k of hasil.klaim) {
      expect(k['kode_subacute']).toBeNull();
      expect(k['kode_sr']).toBeNull();
      expect(k['input_sr']).toBeNull();
    }
  });

  it('memecah kolom majemuk PAYOR_ID dan CODER_ID', () => {
    const k = hasil.klaim[0];
    expect(k?.['payor_kode']).toBe('3');
    expect(k?.['payor_nama']).toBe('JKN');
    expect(k?.['coder_id']).toMatch(/^SNTKD-\d\d$/);
  });

  it('menurunkan kolom dari C2 dan membuang sub-field sensitif', () => {
    const k = hasil.klaim[0];
    expect(k?.['cara_masuk']).toBeTypeOf('string');
    expect(JSON.stringify(hasil.klaim)).not.toContain('JANGAN TAMPIL SINTETIS');
    expect(JSON.stringify(hasil.klaim)).not.toContain('1111111111111111');
  });

  it('mencatat nomor baris asal untuk penelusuran balik', () => {
    expect(hasil.klaim[0]?.nomor_baris).toBe(2);
    expect(hasil.klaim[19]?.nomor_baris).toBe(21);
    expect(hasil.klaim[0]?.berkas).toBe('uji.TXT');
  });
});

describe('berkas rusak', () => {
  it('melewati baris dengan jumlah kolom berbeda dan melaporkannya', () => {
    const berkas = buatBerkasSintetis(map, {
      jumlah: 5,
      benih: 2,
      cacat: [{ jenis: 'jumlah_field_berbeda', baris: 3 }],
    });
    const hasil = parse(berkas.teks);

    expect(hasil.ringkasan.barisTerparse).toBe(4);
    expect(hasil.ringkasan.barisGagal).toBe(1);
    expect(kode(padaBaris(hasil.peringatan, 4))).toContain('JUMLAH_FIELD_BERBEDA');
    expect(hasil.klaim.map((k) => k.nomor_baris)).not.toContain(4);
  });

  it('melewati baris kosong di tengah berkas dan melaporkannya', () => {
    const berkas = buatBerkasSintetis(map, {
      jumlah: 5,
      benih: 3,
      cacat: [{ jenis: 'baris_kosong_setelah', baris: 2 }],
    });
    const hasil = parse(berkas.teks);

    expect(hasil.ringkasan.barisTerparse).toBe(5);
    expect(kode(hasil.peringatan)).toContain('BARIS_KOSONG');
  });

  it('tidak mengeluhkan baris kosong di akhir berkas', () => {
    const berkas = buatBerkasSintetis(map, { jumlah: 3, benih: 4 });
    const hasil = parse(`${berkas.teks}\r\n\r\n`);

    expect(hasil.ringkasan.barisTerparse).toBe(3);
    expect(kode(hasil.peringatan)).not.toContain('BARIS_KOSONG');
  });

  it('menolak berkas tanpa pemisah TAB di header', () => {
    const hasil = parse('ini,bukan,berkas,eklaim\r\n1,2,3,4\r\n');
    expect(kode(hasil.peringatan)).toContain('HEADER_TANPA_PEMISAH');
    expect(hasil.klaim).toEqual([]);
  });

  it('menolak berkas yang kekurangan kolom dan menyebut kolom yang hilang', () => {
    const berkas = buatBerkasSintetis(map, { jumlah: 2, benih: 5 });
    const baris = berkas.teks.split('\r\n');
    const dipotong = baris
      .filter((l) => l !== '')
      .map((l) => l.split('\t').slice(0, 50).join('\t'))
      .join('\r\n');
    const hasil = parse(`${dipotong}\r\n`);

    expect(kode(hasil.peringatan)).toContain('KOLOM_HILANG');
    expect(hasil.peringatan[0]?.pesan).toContain('SEP');
    expect(hasil.peringatan[0]?.pesan).toContain('43 kolom');
    expect(hasil.klaim).toEqual([]);
  });

  it('tetap membaca berkas ketika urutan kolom berbeda', () => {
    const berkas = buatBerkasSintetis(map, { jumlah: 3, benih: 6 });
    const baris = berkas.teks.split('\r\n').filter((l) => l !== '');
    const urutanBaru = baris.map((l) => {
      const sel = l.split('\t');
      const [pertama, kedua, ...sisa] = sel;
      return [kedua ?? '', pertama ?? '', ...sisa].join('\t');
    });
    const hasil = parse(`${urutanBaru.join('\r\n')}\r\n`);

    expect(kode(hasil.peringatan)).toContain('URUTAN_KOLOM_BERBEDA');
    expect(hasil.ringkasan.barisTerparse).toBe(3);
    expect(hasil.klaim[0]?.['kode_rs']).toBe('0000000');
    expect(hasil.klaim[0]?.['kelas_rs']).toBe('C');
  });

  it('melaporkan berkas kosong', () => {
    const hasil = parseEklaim(new Uint8Array(0), map, { namaBerkas: 'kosong.TXT' });
    expect(kode(hasil.peringatan)).toContain('BERKAS_KOSONG');
  });

  it('melaporkan tanggal yang tidak sah tanpa menggagalkan baris', () => {
    const berkas = buatBerkasSintetis(map, {
      jumlah: 3,
      benih: 7,
      cacat: [{ jenis: 'tanggal_tidak_sah', baris: 2 }],
    });
    const hasil = parse(berkas.teks);

    expect(kode(padaBaris(hasil.peringatan, 3))).toContain('TANGGAL_TIDAK_SAH');
    expect(hasil.ringkasan.barisTerparse).toBe(3);
    expect(hasil.klaim[1]?.['tanggal_masuk']).toBeNull();
  });

  it('melaporkan nilai di luar daftar yang dikenali', () => {
    const berkas = buatBerkasSintetis(map, {
      jumlah: 2,
      benih: 8,
      cacat: [{ jenis: 'ptd_tidak_dikenali', baris: 1 }],
    });
    const hasil = parse(berkas.teks);
    expect(kode(padaBaris(hasil.peringatan, 2))).toContain('NILAI_DI_LUAR_DAFTAR');
  });

  it('melaporkan JSON C2 rusak per baris dan tetap memproses baris lain', () => {
    const berkas = buatBerkasSintetis(map, {
      jumlah: 5,
      benih: 9,
      cacat: [{ jenis: 'json_c2_rusak', baris: 2 }],
    });
    const hasil = parse(berkas.teks);

    expect(hasil.ringkasan.barisTerparse).toBe(5);
    expect(kode(padaBaris(hasil.peringatan, 3))).toContain('C2_JSON_RUSAK');
    expect(hasil.klaim[1]?.['cara_masuk']).toBeNull();
    expect(hasil.klaim[2]?.['cara_masuk']).toBeTypeOf('string');
  });

  it('berhenti setelah terlalu banyak baris gagal berturut-turut', () => {
    const berkas = buatBerkasSintetis(map, {
      jumlah: 6,
      benih: 10,
      cacat: [
        { jenis: 'jumlah_field_berbeda', baris: 1 },
        { jenis: 'jumlah_field_berbeda', baris: 2 },
        { jenis: 'jumlah_field_berbeda', baris: 3 },
      ],
    });
    const hasil = parseEklaim(keBytes(berkas.teks), map, { batasBarisGagal: 3 });

    expect(kode(hasil.peringatan)).toContain('TERLALU_BANYAK_BARIS_GAGAL');
    expect(hasil.klaim).toEqual([]);
  });
});

describe('encoding dan akhir baris', () => {
  it('membaca ASCII dengan CRLF tanpa peringatan encoding', () => {
    const berkas = buatBerkasSintetis(map, { jumlah: 3, benih: 11 });
    const hasil = parse(berkas.teks);
    const kodePeringatan = kode(hasil.peringatan);

    expect(kodePeringatan).not.toContain('ENCODING_BUKAN_ASCII');
    expect(kodePeringatan).not.toContain('AKHIR_BARIS_BUKAN_CRLF');
  });

  it('memperingatkan berkas dengan akhir baris LF', () => {
    const berkas = buatBerkasSintetis(map, { jumlah: 3, benih: 12, akhirBaris: '\n' });
    const hasil = parse(berkas.teks);

    expect(kode(hasil.peringatan)).toContain('AKHIR_BARIS_BUKAN_CRLF');
    expect(hasil.ringkasan.barisTerparse).toBe(3);
  });

  it('memperingatkan berkas yang memuat karakter di luar ASCII', () => {
    const berkas = buatBerkasSintetis(map, { jumlah: 2, benih: 13 });
    const diubah = berkas.teks.replace('DESKRIPSI SINTETIS', 'DESKRIPSI SÍNTETIS');
    const hasil = parse(diubah, 'utf8');

    expect(kode(hasil.peringatan)).toContain('ENCODING_BUKAN_ASCII');
    expect(hasil.ringkasan.barisTerparse).toBe(2);
  });

  it('memperingatkan BOM UTF-8 dan tetap membaca berkas', () => {
    const berkas = buatBerkasSintetis(map, { jumlah: 2, benih: 14 });
    const hasil = parse(`﻿${berkas.teks}`, 'utf8');

    expect(kode(hasil.peringatan)).toContain('ENCODING_BOM_UTF8');
    expect(hasil.ringkasan.barisTerparse).toBe(2);
  });

  it('membaca berkas UTF-16 dengan peringatan', () => {
    const berkas = buatBerkasSintetis(map, { jumlah: 2, benih: 15 });
    const hasil = parse(berkas.teks, 'utf16le');

    expect(kode(hasil.peringatan)).toContain('ENCODING_UTF16');
    expect(hasil.ringkasan.barisTerparse).toBe(2);
  });
});
