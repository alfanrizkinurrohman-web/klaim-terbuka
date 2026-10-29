import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { terapkanParameter } from '../src/rules/engine';
import { muatAturan } from '../src/rules/muat';
import { KATA_KUNCI_TERLARANG } from '../src/rules/schema';
import { AKAR_RULES, aturanDenganId, berkasAturan, semuaAturan } from './support/aturan';

/** Aturan minimal yang sah, dipakai sebagai dasar test penolakan. */
const ATURAN_SAH = `
id: contoh-aturan
judul: Contoh aturan
kategori: contoh
status: draft
deskripsi: Aturan contoh untuk test.
sumber_regulasi: null
query: |
  SELECT nomor_baris FROM klaim
kolom_output:
  - nama: nomor_baris
    label: Baris
bukti_yang_perlu_diperiksa:
  - Periksa sesuatu di rekam medis.
catatan_etika: Hanya untuk test.
`;

function tolak(ubah: string): string {
  const hasil = muatAturan([{ jalur: 'uji.yaml', teks: ubah }]);
  expect(hasil.aturan, 'aturan seharusnya ditolak').toHaveLength(0);
  return hasil.ditolak[0]?.pesan ?? '';
}

describe('berkas aturan di rules/', () => {
  it('semuanya lulus validasi skema', () => {
    const hasil = muatAturan(berkasAturan());
    expect(hasil.ditolak).toEqual([]);
  });

  it('memuat kedelapan aturan Fase 2', () => {
    const id = semuaAturan()
      .map((a) => a.id)
      .sort();
    expect(id).toEqual([
      'duplikasi-klaim',
      'icu-tidak-konsisten',
      'komponen-tarif-tidak-wajar',
      'perbedaan-daftar-diagnosis',
      'rawat-inap-berulang',
      'rawat-inap-los-1-hari',
      'rawat-jalan-hari-libur',
      'rawat-jalan-kelas-rawat',
    ]);
  });

  it('tidak ada aturan yang mengaku tervalidasi tanpa sumber regulasi', () => {
    for (const a of semuaAturan()) {
      if (a.status === 'tervalidasi') {
        expect(a.sumber_regulasi, `aturan ${a.id}`).toBeTruthy();
      }
    }
  });

  it('setiap aturan menyebut bukti yang perlu diperiksa dan catatan etika', () => {
    for (const a of semuaAturan()) {
      expect(a.bukti_yang_perlu_diperiksa.length, `aturan ${a.id}`).toBeGreaterThan(0);
      expect(a.catatan_etika.length, `aturan ${a.id}`).toBeGreaterThan(20);
    }
  });

  it('merumuskan bukti sebagai pemeriksaan, bukan perintah mengubah kode', () => {
    // Prinsip 3: temuan berbunyi "periksa bukti X", bukan "ganti kode menjadi Y".
    const terlarang = /\b(ganti|ubah|naikkan|tingkatkan|sesuaikan)\s+(kode|diagnosis|severity)/i;
    for (const a of semuaAturan()) {
      for (const bukti of a.bukti_yang_perlu_diperiksa) {
        expect(bukti, `aturan ${a.id}`).not.toMatch(terlarang);
        expect(bukti.toLowerCase(), `aturan ${a.id}`).toContain('periksa');
      }
    }
  });

  it('tidak menjanjikan kenaikan nilai klaim di deskripsi mana pun', () => {
    const terlarang = /\b(menaikkan|memaksimalkan|mengoptimalkan)\s+(klaim|tarif|pendapatan)/i;
    for (const a of semuaAturan()) {
      for (const teks of [a.deskripsi, a.catatan_etika, a.judul, a.catatan ?? '']) {
        expect(teks, `aturan ${a.id}`).not.toMatch(terlarang);
      }
    }
  });
});

describe('contekan rules/_template.yaml', () => {
  const teks = readFileSync(join(AKAR_RULES, '_template.yaml'), 'utf8');

  it('lulus validasi skema, supaya hasil salinannya langsung jalan', () => {
    const hasil = muatAturan([{ jalur: 'rules/_template.yaml', teks }]);
    expect(hasil.ditolak).toEqual([]);
    expect(hasil.aturan).toHaveLength(1);
  });

  it('tidak ikut dimuat sebagai aturan sungguhan', () => {
    expect(berkasAturan().map((b) => b.jalur)).not.toContain('rules/_template.yaml');
    expect(semuaAturan().map((a) => a.id)).not.toContain('contoh-aturan-baru');
  });

  it('mencontohkan status draft tanpa sumber regulasi karangan', () => {
    const hasil = muatAturan([{ jalur: 'rules/_template.yaml', teks }]);
    expect(hasil.aturan[0]?.status).toBe('draft');
    expect(hasil.aturan[0]?.sumber_regulasi).toBeNull();
  });
});

describe('penolakan aturan yang tidak valid', () => {
  it('menerima aturan dasar yang sah', () => {
    const hasil = muatAturan([{ jalur: 'uji.yaml', teks: ATURAN_SAH }]);
    expect(hasil.ditolak).toEqual([]);
    expect(hasil.aturan).toHaveLength(1);
  });

  it('menolak status tervalidasi tanpa sumber_regulasi', () => {
    const pesan = tolak(ATURAN_SAH.replace('status: draft', 'status: tervalidasi'));
    expect(pesan).toContain('sumber_regulasi');
  });

  it.each(KATA_KUNCI_TERLARANG)('menolak query yang memuat %s', (kata) => {
    const query = `  SELECT nomor_baris FROM klaim WHERE ${kata} IS NULL`;
    const pesan = tolak(ATURAN_SAH.replace('  SELECT nomor_baris FROM klaim', query));
    expect(pesan.toUpperCase()).toContain(kata);
  });

  it('menolak query yang tidak dimulai dengan SELECT atau WITH', () => {
    const pesan = tolak(
      ATURAN_SAH.replace('  SELECT nomor_baris FROM klaim', '  TABLE klaim'),
    );
    expect(pesan).toContain('SELECT atau WITH');
  });

  it('tidak bisa diakali dengan menyembunyikan kata kunci di komentar SQL', () => {
    const query = '  SELECT nomor_baris FROM klaim -- DELETE FROM klaim';
    const hasil = muatAturan([
      { jalur: 'uji.yaml', teks: ATURAN_SAH.replace('  SELECT nomor_baris FROM klaim', query) },
    ]);
    // Komentar dibuang sebelum diperiksa, jadi aturan ini justru SAH.
    expect(hasil.ditolak).toEqual([]);
  });

  it('menolak dua pernyataan dalam satu query', () => {
    const query = '  SELECT nomor_baris FROM klaim; SELECT 1';
    const pesan = tolak(ATURAN_SAH.replace('  SELECT nomor_baris FROM klaim', query));
    expect(pesan).toContain('satu pernyataan');
  });

  it('menolak kolom_output yang tidak ada di query', () => {
    const pesan = tolak(ATURAN_SAH.replace('nama: nomor_baris', 'nama: kolom_khayalan'));
    expect(pesan).toContain('kolom_khayalan');
  });

  it('menolak parameter yang dipakai tetapi tidak dideklarasikan', () => {
    const query = '  SELECT nomor_baris FROM klaim WHERE los < {{ambang}}';
    const pesan = tolak(ATURAN_SAH.replace('  SELECT nomor_baris FROM klaim', query));
    expect(pesan).toContain('ambang');
  });

  it('menolak parameter yang dideklarasikan tetapi tidak dipakai', () => {
    const tambahan = `
parameter:
  - nama: ambang
    deskripsi: Tidak dipakai.
    tipe: bilangan
    bawaan: 1
`;
    const pesan = tolak(ATURAN_SAH + tambahan);
    expect(pesan).toContain('tidak dipakai');
  });

  it('menolak id ganda antar-berkas', () => {
    const hasil = muatAturan([
      { jalur: 'a.yaml', teks: ATURAN_SAH },
      { jalur: 'b.yaml', teks: ATURAN_SAH },
    ]);
    expect(hasil.aturan).toHaveLength(1);
    expect(hasil.ditolak[0]?.pesan).toContain('sudah dipakai');
  });

  it('menolak YAML yang rusak tanpa menjatuhkan aturan lain', () => {
    const hasil = muatAturan([
      { jalur: 'rusak.yaml', teks: 'id: [tidak ditutup' },
      { jalur: 'sah.yaml', teks: ATURAN_SAH },
    ]);
    expect(hasil.aturan).toHaveLength(1);
    expect(hasil.ditolak).toHaveLength(1);
    expect(hasil.ditolak[0]?.jalur).toBe('rusak.yaml');
  });
});

describe('penerapan parameter', () => {
  it('memakai nilai bawaan bila tidak diberi nilai', () => {
    const { sql, terpakai } = terapkanParameter(aturanDenganId('rawat-inap-berulang'));
    expect(terpakai['ambang_hari']).toBe(30);
    expect(sql).toContain('<= 30');
    expect(sql).not.toContain('{{');
  });

  it('memakai nilai yang diberikan', () => {
    const { sql, terpakai } = terapkanParameter(aturanDenganId('rawat-inap-berulang'), {
      ambang_hari: 7,
    });
    expect(terpakai['ambang_hari']).toBe(7);
    expect(sql).toContain('<= 7');
  });

  it('menolak nilai parameter bilangan yang bukan angka', () => {
    expect(() =>
      terapkanParameter(aturanDenganId('rawat-inap-berulang'), {
        ambang_hari: '30 OR 1=1',
      }),
    ).toThrow(/harus bilangan/);
  });

  it('menolak parameter teks yang memuat karakter berbahaya', () => {
    const aturan = {
      ...aturanDenganId('rawat-inap-berulang'),
      parameter: [
        {
          nama: 'ambang_hari',
          deskripsi: 'uji',
          tipe: 'teks' as const,
          bawaan: "';DROP",
        },
      ],
    };
    expect(() => terapkanParameter(aturan)).toThrow(/tidak diizinkan/);
  });
});
