import { describe, expect, it } from 'vitest';

import { kolomIdentitas, kolomKomponenTarif, muatColumnMap } from '../src/parser/columnMap';
import { mapUji } from './helpers';

describe('config/column-map.yaml', () => {
  it('memuat 93 kolom sesuai berkas ekspor E-Klaim', () => {
    expect(mapUji().kolom).toHaveLength(93);
  });

  it('menandai seluruh kolom identitas yang wajib di-mask', () => {
    const identitas = kolomIdentitas(mapUji());
    for (const nama of [
      'nama_pasien',
      'mrn',
      'sep',
      'nomor_kartu',
      'tanggal_lahir',
      'dpjp',
      'coder_id',
    ]) {
      expect(identitas).toContain(nama);
    }
  });

  it('menandai tepat 18 komponen penyusun tarif RS', () => {
    expect(kolomKomponenTarif(mapUji())).toHaveLength(18);
  });

  it('tidak memuat nama kolom baku yang ganda', () => {
    const map = mapUji();
    const semua = map.kolom.flatMap((k) => [
      k.nama,
      ...(k.sub_field?.map((s) => s.nama) ?? []),
    ]);
    expect(new Set(semua).size).toBe(semua.length);
  });

  it('menolak YAML yang bukan YAML sah dengan pesan yang jelas', () => {
    expect(() => muatColumnMap('kolom: [ {')).toThrow(/bukan YAML yang sah/);
  });

  it('menolak kolom enum tanpa daftar nilai', () => {
    const yamlBuruk = `
versi: 1
pemisah_kolom: "\\t"
pemisah_daftar: ";"
format_tanggal: "DD/MM/YYYY"
nilai_kosong: [""]
kolom:
  - sumber: PTD
    nama: ptd
    tipe: enum
`;
    expect(() => muatColumnMap(yamlBuruk)).toThrow(/enum wajib mencantumkan/);
  });

  it('menolak nama kolom baku yang bukan snake_case', () => {
    const yamlBuruk = `
versi: 1
pemisah_kolom: "\\t"
pemisah_daftar: ";"
format_tanggal: "DD/MM/YYYY"
nilai_kosong: [""]
kolom:
  - sumber: PTD
    nama: PTD
    tipe: kode
`;
    expect(() => muatColumnMap(yamlBuruk)).toThrow(/snake_case/);
  });
});
