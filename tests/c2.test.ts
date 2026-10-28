import { describe, expect, it } from 'vitest';

import { buangSubFieldSensitif, SF, SF_DIBUANG, uraikanC2 } from '../src/parser/c2';
import { kode } from './helpers';

/** C2 sintetis dengan 14 sub-field; sub-field 12 dan 13 berisi identitas palsu. */
function c2Contoh(jsonKlinis: string): string {
  return [
    '1',
    '1',
    'kelas_1',
    '0',
    '250000',
    '0.0',
    '2026-09-12 10:30:00',
    '0',
    '00:00:00',
    '00:00:00',
    '00:00:00',
    '{"nama":"RAHASIA SINTETIS","nik":"1234567890123456"}',
    '{"registri_tb":{"nama":"RAHASIA SINTETIS","nik":"6543210987654321"}}',
    jsonKlinis,
  ].join('#');
}

const JSON_LENGKAP = JSON.stringify({
  cara_masuk: 'emd',
  sistole: '120',
  diastole: '80',
  selisih_biaya: { nilai: '250000', pembayar: 'peserta', naik_kelas: 'kelas_1' },
  ventilator: { use_ind: '1', start_dttm: '0000-00-00 00:00:00', stop_dttm: '0000-00-00 00:00:00' },
  persalinan: {
    usia_kehamilan: '38',
    gravida: '2',
    partus: '1',
    abortus: '0',
    onset_kontraksi: 'spontan',
    delivery: [{ delivery_method: 'sc', letak_janin: 'kepala' }],
  },
  apgar_score: '8/9',
  kantong_darah: '2',
  alteplase_ind: '0',
  dializer_single_use: 'na',
});

describe('privasi kolom C2', () => {
  it('membuang sub-field 12 dan 13 tanpa mengubah posisi sub-field lain', () => {
    const aman = buangSubFieldSensitif(c2Contoh(JSON_LENGKAP));
    const bagian = aman.split('#');

    expect(bagian).toHaveLength(14);
    for (const posisi of SF_DIBUANG) {
      expect(bagian[posisi - 1]).toBe('');
    }
    expect(bagian[SF.NAIK_KELAS - 1]).toBe('1');
    expect(bagian[SF.KELAS_TUJUAN - 1]).toBe('kelas_1');
    expect(bagian[SF.WAKTU_GROUPING - 1]).toBe('2026-09-12 10:30:00');
    expect(bagian[SF.JSON_KLINIS - 1]).toBe(JSON_LENGKAP);
  });

  it('tidak menyisakan jejak NIK atau nama dari registri TB', () => {
    const aman = buangSubFieldSensitif(c2Contoh(JSON_LENGKAP));
    expect(aman).not.toContain('RAHASIA SINTETIS');
    expect(aman).not.toContain('1234567890123456');
    expect(aman).not.toContain('6543210987654321');

    const hasil = uraikanC2(c2Contoh(JSON_LENGKAP), 2);
    const semua = JSON.stringify(hasil.turunan);
    expect(semua).not.toContain('RAHASIA SINTETIS');
    expect(semua).not.toContain('1234567890123456');
  });

  it('tetap membuang sub-field sensitif meski jumlah sub-field tidak utuh', () => {
    const pendek = c2Contoh(JSON_LENGKAP).split('#').slice(0, 13).join('#');
    const aman = buangSubFieldSensitif(pendek);
    expect(aman).not.toContain('1234567890123456');
    expect(aman).not.toContain('6543210987654321');
  });
});

describe('penguraian C2', () => {
  it('mengambil kolom turunan dari sub-field dan JSON', () => {
    const { turunan, peringatan } = uraikanC2(c2Contoh(JSON_LENGKAP), 2);

    expect(peringatan).toEqual([]);
    expect(turunan['naik_kelas']).toBe('1');
    expect(turunan['kelas_tujuan']).toBe('kelas_1');
    expect(turunan['waktu_grouping']).toBe('2026-09-12 10:30:00');
    expect(turunan['cara_masuk']).toBe('emd');
    expect(turunan['sistole']).toBe(120);
    expect(turunan['diastole']).toBe(80);
    expect(turunan['selisih_biaya_nilai']).toBe(250000);
    expect(turunan['selisih_biaya_pembayar']).toBe('peserta');
    expect(turunan['ventilator_digunakan']).toBe('1');
    expect(turunan['persalinan_gravida']).toBe(2);
    expect(turunan['persalinan_usia_kehamilan']).toBe(38);
    expect(turunan['persalinan_metode']).toEqual(['sc']);
    expect(turunan['apgar_score']).toBe('8/9');
    expect(turunan['kantong_darah']).toBe(2);
  });

  it('memperlakukan ventilator.use_ind kosong sebagai tidak dipakai', () => {
    const json = JSON.stringify({ ventilator: { use_ind: '' } });
    expect(uraikanC2(c2Contoh(json), 2).turunan['ventilator_digunakan']).toBe('0');
  });

  it('melaporkan JSON rusak sebagai peringatan, bukan melempar galat', () => {
    const rusak = '{"cara_masuk":"emd","billing_group":{';
    const { turunan, peringatan } = uraikanC2(c2Contoh(rusak), 7);

    expect(kode(peringatan)).toContain('C2_JSON_RUSAK');
    expect(peringatan[0]?.baris).toBe(7);
    // Sub-field di luar JSON tetap terbaca.
    expect(turunan['naik_kelas']).toBe('1');
    expect(turunan['cara_masuk']).toBeNull();
  });

  it('melaporkan jumlah sub-field yang tidak 14', () => {
    const pendek = c2Contoh(JSON_LENGKAP).split('#').slice(0, 8).join('#');
    const { peringatan } = uraikanC2(pendek, 3);
    expect(kode(peringatan)).toContain('C2_JUMLAH_SUBFIELD');
  });

  it('melaporkan C2 kosong tanpa menggagalkan baris', () => {
    const { turunan, peringatan } = uraikanC2('', 4);
    expect(kode(peringatan)).toContain('C2_KOSONG');
    expect(turunan['cara_masuk']).toBeNull();
  });

  it('melaporkan JSON yang sah tetapi bukan objek', () => {
    const { peringatan } = uraikanC2(c2Contoh('[1,2,3]'), 5);
    expect(kode(peringatan)).toContain('C2_JSON_BUKAN_OBJEK');
  });
});
