/**
 * Titik masuk modul parser.
 *
 * Pemakaian khas (di browser maupun di test):
 *
 *   const map = muatColumnMap(teksYaml);
 *   const hasil = parseEklaim(bytes, map, { namaBerkas: f.name });
 *   const relasi = validasiSemua(hasil.klaim, map);
 */
export { muatColumnMap, kolomIdentitas, kolomKomponenTarif } from './columnMap';
export type { ColumnMap, DefinisiKolom, TipeKolom } from './columnMap';

export { parseEklaim } from './parseEklaim';
export type { OpsiParsing } from './parseEklaim';

export { validasiSemua, validasiKlaim, TOLERANSI_IDRG_FAKTOR } from './validate';

export { dekodeBerkas, pecahBaris } from './decode';
export { uraikanTanggal, selisihHari } from './normalize';
export {
  buangSubFieldSensitif,
  uraikanC2,
  SF,
  SF_DIBUANG,
  C2_JUMLAH_SUBFIELD,
  C2_PEMISAH,
} from './c2';

export type {
  Klaim,
  HasilParsing,
  Peringatan,
  TingkatPeringatan,
  NilaiKlaim,
  RingkasanParsing,
} from './types';
