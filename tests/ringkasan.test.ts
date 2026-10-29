import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { samarkanNilai, samarkanSemua } from '../src/privasi/mask';
import type { KoneksiKlaim } from '../src/db/types';
import {
  CATATAN_RINGKASAN_DPJP,
  KOLOM_RINGKASAN_DPJP,
  ringkasanPerBerkas,
  ringkasanPerDpjp,
} from '../src/rules/ringkasan';
import { mapUji } from './helpers';
import { isiTabel } from './support/db';
import { buatKoneksiUji } from './support/duckdbNode';
import { klaimUji } from './support/klaim';

let koneksi: KoneksiKlaim;

beforeAll(async () => {
  koneksi = await buatKoneksiUji();
}, 60_000);

afterAll(async () => {
  await koneksi?.tutup();
});

describe('ringkasan per DPJP', () => {
  it('menghitung jumlah kasus dan distribusi severity', async () => {
    await isiTabel(koneksi, [
      klaimUji(2, { dpjp: 'SNT-01', ptd: '1', kode_inacbg: 'M-4-16-II' }),
      klaimUji(3, { dpjp: 'SNT-01', ptd: '1', kode_inacbg: 'M-4-16-III' }),
      klaimUji(4, { dpjp: 'SNT-01', ptd: '2', kode_inacbg: 'M-3-16-0' }),
      klaimUji(5, { dpjp: 'SNT-02', ptd: '1', kode_inacbg: 'K-4-10-I' }),
    ]);
    const baris = await ringkasanPerDpjp(koneksi);

    expect(baris).toHaveLength(2);
    const pertama = baris[0];
    expect(pertama?.['dpjp']).toBe('SNT-01');
    expect(pertama?.['jumlah_kasus']).toBe(3);
    expect(pertama?.['jumlah_rawat_inap']).toBe(2);
    expect(pertama?.['jumlah_rawat_jalan']).toBe(1);
    expect(pertama?.['severity_0']).toBe(1);
    expect(pertama?.['severity_1']).toBe(0);
    expect(pertama?.['severity_2']).toBe(1);
    expect(pertama?.['severity_3']).toBe(1);
  });

  it('mengambil severity dari segmen keempat kode INA-CBG', async () => {
    await isiTabel(koneksi, [
      klaimUji(2, { dpjp: 'SNT-01', kode_inacbg: 'W-1-30-I' }),
      klaimUji(3, { dpjp: 'SNT-01', kode_inacbg: 'V-1-14-III' }),
    ]);
    const baris = await ringkasanPerDpjp(koneksi);
    expect(baris[0]?.['severity_1']).toBe(1);
    expect(baris[0]?.['severity_3']).toBe(1);
  });

  it('menjumlahkan tarif RS, INA-CBG, dan iDRG beserta selisihnya', async () => {
    await isiTabel(koneksi, [
      klaimUji(2, { dpjp: 'SNT-01', tarif_rs: 1_000_000, total_tarif: 1_500_000, idrg_total_tarif: 1_700_000 }),
      klaimUji(3, { dpjp: 'SNT-01', tarif_rs: 2_000_000, total_tarif: 2_500_000, idrg_total_tarif: 2_800_000 }),
    ]);
    const baris = await ringkasanPerDpjp(koneksi);

    expect(baris[0]?.['jumlah_tarif_rs']).toBe(3_000_000);
    expect(baris[0]?.['jumlah_tarif_inacbg']).toBe(4_000_000);
    expect(baris[0]?.['jumlah_tarif_idrg']).toBe(4_500_000);
    expect(baris[0]?.['selisih_inacbg_dikurangi_rs']).toBe(1_000_000);
    expect(baris[0]?.['selisih_idrg_dikurangi_inacbg']).toBe(500_000);
  });

  it('mengurutkan dari jumlah kasus terbanyak', async () => {
    await isiTabel(koneksi, [
      klaimUji(2, { dpjp: 'SNT-01' }),
      klaimUji(3, { dpjp: 'SNT-02' }),
      klaimUji(4, { dpjp: 'SNT-02' }),
    ]);
    const baris = await ringkasanPerDpjp(koneksi);
    expect(baris.map((b) => b['dpjp'])).toEqual(['SNT-02', 'SNT-01']);
  });

  it('menandai dpjp sebagai kolom identitas dan menyertakan peringatan tafsir', () => {
    const dpjp = KOLOM_RINGKASAN_DPJP.find((k) => k.nama === 'dpjp');
    expect(dpjp?.identitas).toBe(true);
    expect(CATATAN_RINGKASAN_DPJP).toContain('bukan penilaian kinerja');
  });

  it('seluruh kolom yang dilabeli benar-benar ada di hasil', async () => {
    await isiTabel(koneksi, [klaimUji(2, { dpjp: 'SNT-01' })]);
    const baris = await ringkasanPerDpjp(koneksi);
    for (const k of KOLOM_RINGKASAN_DPJP) {
      expect(baris[0], `kolom ${k.nama}`).toHaveProperty(k.nama);
    }
  });
});

describe('ringkasan per berkas', () => {
  it('menghitung jumlah klaim, pasien, versi, dan rentang tanggal', async () => {
    await isiTabel(koneksi, [
      klaimUji(2, { mrn: '555001', tanggal_masuk: '2026-06-01', tanggal_pulang: '2026-06-03' }, 'a.TXT'),
      klaimUji(3, { mrn: '555001', tanggal_masuk: '2026-06-10', tanggal_pulang: '2026-06-12' }, 'a.TXT'),
      klaimUji(4, { mrn: '555002', versi_inacbg: '5.10.9.202609291001' }, 'b.TXT'),
    ]);
    const baris = await ringkasanPerBerkas(koneksi);

    expect(baris).toHaveLength(2);
    expect(baris[0]?.['berkas']).toBe('a.TXT');
    expect(baris[0]?.['jumlah_klaim']).toBe(2);
    expect(baris[0]?.['jumlah_pasien']).toBe(1);
    expect(baris[0]?.['tanggal_masuk_paling_awal']).toBe('2026-06-01');
    expect(baris[0]?.['tanggal_pulang_paling_akhir']).toBe('2026-06-12');
  });

  it('menghitung jumlah versi INA-CBG dalam satu berkas', async () => {
    await isiTabel(koneksi, [
      klaimUji(2, { versi_inacbg: '5.10.7.202603311031' }),
      klaimUji(3, { versi_inacbg: '5.10.8.202606251251' }),
      klaimUji(4, { versi_inacbg: '5.10.8.202606251251' }),
    ]);
    const baris = await ringkasanPerBerkas(koneksi);
    expect(baris[0]?.['jumlah_versi_inacbg']).toBe(2);
  });
});

describe('penyamaran kolom identitas', () => {
  it('menyamarkan nama pasien tetapi menyisakan huruf awal', () => {
    expect(samarkanNilai('nama_pasien', 'SITI AMINAH')).toBe('S••• A•••');
  });

  it('menyisakan empat karakter terakhir nomor', () => {
    expect(samarkanNilai('mrn', '100123')).toBe('••0123');
    expect(samarkanNilai('nomor_kartu', '8000000000123')).toBe('•••••••••0123');
  });

  it('menyisakan tahun saja pada tanggal lahir', () => {
    expect(samarkanNilai('tanggal_lahir', '1986-03-14')).toBe('1986');
  });

  it('menyamarkan DPJP dan coder tetapi tetap bisa dibedakan', () => {
    expect(samarkanNilai('dpjp', 'SNT-01')).toBe('SN•••');
    expect(samarkanNilai('coder_id', 'SNTKD-01')).toBe('SN•••');
  });

  it('mengembalikan null untuk nilai kosong', () => {
    expect(samarkanNilai('mrn', null)).toBeNull();
    expect(samarkanNilai('mrn', '')).toBeNull();
  });

  it('menyamarkan secara bawaan tanpa perlu diminta', () => {
    const hasil = samarkanSemua(
      [{ mrn: '100123', nama_pasien: 'SITI AMINAH', total_tarif: 1_500_000 }],
      mapUji(),
    );
    expect(hasil[0]?.['mrn']).toBe('••0123');
    expect(hasil[0]?.['nama_pasien']).toBe('S••• A•••');
    // Kolom bukan identitas tidak diubah.
    expect(hasil[0]?.['total_tarif']).toBe(1_500_000);
  });

  it('hanya membuka samaran bila diminta secara eksplisit', () => {
    const baris = [{ mrn: '100123', nama_pasien: 'SITI AMINAH' }];
    const terbuka = samarkanSemua(baris, mapUji(), { bukaSamaran: true });
    expect(terbuka[0]?.['mrn']).toBe('100123');
  });

  it('bisa menyamarkan alias kolom dari query aturan', () => {
    const hasil = samarkanSemua([{ nama_dpjp_sebelumnya: 'SNT-09' }], mapUji(), {
      kolomTambahan: ['nama_dpjp_sebelumnya'],
    });
    expect(hasil[0]?.['nama_dpjp_sebelumnya']).toBe('SN•••');
  });
});
