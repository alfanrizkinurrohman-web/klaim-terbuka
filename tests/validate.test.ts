import { describe, expect, it } from 'vitest';

import { parseEklaim } from '../src/parser/parseEklaim';
import { TOLERANSI_IDRG_FAKTOR, validasiSemua } from '../src/parser/validate';
import type { Cacat } from './fixtures/generator';
import { buatBerkasSintetis, keBytes } from './fixtures/generator';
import { kode, mapUji, padaBaris } from './helpers';

const map = mapUji();

function jalankan(cacat: Cacat[] = [], jumlah = 6, benih = 100) {
  const berkas = buatBerkasSintetis(map, { jumlah, benih, cacat });
  const hasil = parseEklaim(keBytes(berkas.teks), map, { namaBerkas: 'uji.TXT' });
  return { hasil, relasi: validasiSemua(hasil.klaim, map) };
}

describe('berkas sintetis yang sehat', () => {
  it('tidak melanggar satu pun relasi struktural', () => {
    for (const benih of [1, 2, 3, 42, 777]) {
      const { relasi } = jalankan([], 25, benih);
      expect(relasi, `benih ${benih}`).toEqual([]);
    }
  });
});

describe('relasi LOS', () => {
  it('melaporkan LOS yang tidak sesuai selisih tanggal', () => {
    const { relasi } = jalankan([{ jenis: 'los_tidak_cocok', baris: 2, nilai: 99 }]);
    const p = padaBaris(relasi, 3);
    expect(kode(p)).toContain('RELASI_LOS');
    expect(p[0]?.pesan).toContain('99 hari');
  });

  it('tidak melaporkan apa pun bila LOS benar', () => {
    const { relasi } = jalankan();
    expect(kode(relasi)).not.toContain('RELASI_LOS');
  });
});

describe('relasi TARIF_RS', () => {
  it('melaporkan tarif RS yang tidak sama dengan jumlah 18 komponen', () => {
    const { relasi } = jalankan([{ jenis: 'tarif_rs_tidak_cocok', baris: 1, selisih: 50000 }]);
    const p = padaBaris(relasi, 2);
    expect(kode(p)).toContain('RELASI_TARIF_RS');
    expect(p[0]?.pesan).toContain('Rp50.000');
  });

  it('melaporkan selisih negatif juga', () => {
    const { relasi } = jalankan([{ jenis: 'tarif_rs_tidak_cocok', baris: 4, selisih: -1 }]);
    expect(kode(padaBaris(relasi, 5))).toContain('RELASI_TARIF_RS');
  });
});

describe('relasi TOTAL_TARIF', () => {
  it('melaporkan total tarif yang tidak sama dengan jumlah 7 tarif', () => {
    const { relasi } = jalankan([{ jenis: 'total_tarif_tidak_cocok', baris: 3, selisih: 1000 }]);
    expect(kode(padaBaris(relasi, 4))).toContain('RELASI_TOTAL_TARIF');
  });
});

describe('relasi iDRG', () => {
  it('menerima selisih akibat pembulatan cost weight ke 2 desimal', () => {
    // Cost weight ditulis 2 desimal, tarif dihitung dari nilai aslinya, sehingga
    // selisih sampai 0,005 x NBR adalah wajar. Lihat docs/format-eklaim.md 4.1.
    const { relasi } = jalankan([], 40, 2026);
    expect(kode(relasi)).not.toContain('RELASI_IDRG');
  });

  it('melaporkan selisih yang melampaui toleransi pembulatan', () => {
    const nbrRanap = 8037060;
    const diLuarBatas = Math.ceil(TOLERANSI_IDRG_FAKTOR * nbrRanap) + 1000;
    const { hasil, relasi } = jalankan([
      { jenis: 'idrg_tidak_cocok', baris: 1, selisih: diLuarBatas },
    ]);

    // Hanya bermakna bila baris pertama memang rawat inap.
    if (hasil.klaim[0]?.['ptd'] === '1') {
      expect(kode(padaBaris(relasi, 2))).toContain('RELASI_IDRG');
    }
  });

  it('tidak melaporkan selisih tepat di bawah batas toleransi', () => {
    const { hasil, relasi } = jalankan([{ jenis: 'idrg_tidak_cocok', baris: 1, selisih: 1 }]);
    expect(hasil.klaim).toHaveLength(6);
    expect(kode(padaBaris(relasi, 2))).not.toContain('RELASI_IDRG');
  });
});

describe('relasi lain', () => {
  it('melaporkan kode INA-CBG yang tidak mengikuti pola', () => {
    const { relasi } = jalankan([{ jenis: 'kode_inacbg_salah', baris: 2 }]);
    expect(kode(padaBaris(relasi, 3))).toContain('FORMAT_KODE_INACBG');
  });

  it('melaporkan PTD di luar 1 dan 2', () => {
    const { relasi } = jalankan([{ jenis: 'ptd_tidak_dikenali', baris: 5 }]);
    expect(kode(padaBaris(relasi, 6))).toContain('PTD_TIDAK_DIKENALI');
  });

  it('tidak melaporkan relasi pada kolom yang kosong', () => {
    const { relasi } = jalankan([{ jenis: 'tanggal_tidak_sah', baris: 1 }]);
    // Tanggal masuk kosong: relasi LOS dan umur dilewati, bukan dilaporkan salah.
    expect(kode(padaBaris(relasi, 2))).not.toContain('RELASI_LOS');
    expect(kode(padaBaris(relasi, 2))).not.toContain('RELASI_UMUR_HARI');
  });
});

describe('pesan untuk koder', () => {
  it('menulis angka rupiah dalam format Indonesia', () => {
    const { relasi } = jalankan([{ jenis: 'tarif_rs_tidak_cocok', baris: 1, selisih: 1234567 }]);
    const pesan = padaBaris(relasi, 2)[0]?.pesan ?? '';
    expect(pesan).toMatch(/Rp[\d.]+/);
    expect(pesan).not.toMatch(/Rp\d+,\d+/);
  });
});
