/**
 * Ringkasan agregat: per DPJP dan per berkas.
 *
 * Ringkasan ini BUKAN penilaian kinerja. Angkanya dipengaruhi bauran kasus,
 * sub-spesialisasi, dan pola rujukan, sehingga membandingkan DPJP satu dengan
 * yang lain tanpa menimbang hal-hal itu akan menyesatkan. Gunanya untuk
 * menemukan pola pencatatan yang perlu ditinjau, misalnya distribusi severity
 * yang tiba-tiba berubah atau selisih tarif yang tidak lazim.
 *
 * Kolom dpjp adalah kolom identitas, jadi UI menyamarkannya secara bawaan
 * (lihat src/privasi/mask.ts).
 */
import type { BarisHasil, KoneksiKlaim } from '../db/types';

/**
 * Peringatan yang wajib ditampilkan bersama ringkasan ini di UI.
 */
export const CATATAN_RINGKASAN_DPJP =
  'Ringkasan ini bukan penilaian kinerja DPJP. Jumlah kasus dan distribusi ' +
  'severity sangat bergantung pada bauran kasus dan sub-spesialisasi, sehingga ' +
  'tidak bisa dibandingkan langsung antar-DPJP.';

/**
 * Severity adalah segmen ke-4 kode INA-CBG (0, I, II, III).
 * Jenis rawat TIDAK diambil dari kode INA-CBG, melainkan dari ptd.
 */
const SQL_RINGKASAN_DPJP = `
WITH dasar AS (
  SELECT
    dpjp,
    ptd,
    split_part(kode_inacbg, '-', 4) AS severity,
    coalesce(tarif_rs, 0) AS tarif_rs,
    coalesce(total_tarif, 0) AS total_tarif,
    coalesce(idrg_total_tarif, 0) AS idrg_total_tarif
  FROM klaim
)
SELECT
  dpjp,
  count(*) AS jumlah_kasus,
  count(*) FILTER (WHERE ptd = '1') AS jumlah_rawat_inap,
  count(*) FILTER (WHERE ptd = '2') AS jumlah_rawat_jalan,
  count(*) FILTER (WHERE severity = '0') AS severity_0,
  count(*) FILTER (WHERE severity = 'I') AS severity_1,
  count(*) FILTER (WHERE severity = 'II') AS severity_2,
  count(*) FILTER (WHERE severity = 'III') AS severity_3,
  sum(tarif_rs) AS jumlah_tarif_rs,
  sum(total_tarif) AS jumlah_tarif_inacbg,
  sum(idrg_total_tarif) AS jumlah_tarif_idrg,
  sum(total_tarif) - sum(tarif_rs) AS selisih_inacbg_dikurangi_rs,
  sum(idrg_total_tarif) - sum(total_tarif) AS selisih_idrg_dikurangi_inacbg,
  round(median(tarif_rs)) AS median_tarif_rs,
  round(median(total_tarif)) AS median_tarif_inacbg
FROM dasar
GROUP BY dpjp
ORDER BY jumlah_kasus DESC, dpjp
`;

const SQL_RINGKASAN_BERKAS = `
SELECT
  berkas,
  count(*) AS jumlah_klaim,
  count(*) FILTER (WHERE ptd = '1') AS jumlah_rawat_inap,
  count(*) FILTER (WHERE ptd = '2') AS jumlah_rawat_jalan,
  count(DISTINCT mrn) AS jumlah_pasien,
  count(DISTINCT versi_inacbg) AS jumlah_versi_inacbg,
  min(tanggal_masuk) AS tanggal_masuk_paling_awal,
  max(tanggal_pulang) AS tanggal_pulang_paling_akhir,
  sum(coalesce(tarif_rs, 0)) AS jumlah_tarif_rs,
  sum(coalesce(total_tarif, 0)) AS jumlah_tarif_inacbg,
  sum(coalesce(idrg_total_tarif, 0)) AS jumlah_tarif_idrg
FROM klaim
GROUP BY berkas
ORDER BY berkas
`;

/** Kolom ringkasan DPJP beserta labelnya untuk UI dan ekspor. */
export const KOLOM_RINGKASAN_DPJP: Array<{
  nama: string;
  label: string;
  format: 'teks' | 'angka' | 'rupiah';
  identitas?: boolean;
}> = [
  { nama: 'dpjp', label: 'DPJP', format: 'teks', identitas: true },
  { nama: 'jumlah_kasus', label: 'Jumlah kasus', format: 'angka' },
  { nama: 'jumlah_rawat_inap', label: 'Rawat inap', format: 'angka' },
  { nama: 'jumlah_rawat_jalan', label: 'Rawat jalan', format: 'angka' },
  { nama: 'severity_0', label: 'Severity 0', format: 'angka' },
  { nama: 'severity_1', label: 'Severity I', format: 'angka' },
  { nama: 'severity_2', label: 'Severity II', format: 'angka' },
  { nama: 'severity_3', label: 'Severity III', format: 'angka' },
  { nama: 'jumlah_tarif_rs', label: 'Tarif RS', format: 'rupiah' },
  { nama: 'jumlah_tarif_inacbg', label: 'Tarif INA-CBG', format: 'rupiah' },
  { nama: 'jumlah_tarif_idrg', label: 'Tarif iDRG', format: 'rupiah' },
  {
    nama: 'selisih_inacbg_dikurangi_rs',
    label: 'Selisih INA-CBG − RS',
    format: 'rupiah',
  },
  {
    nama: 'selisih_idrg_dikurangi_inacbg',
    label: 'Selisih iDRG − INA-CBG',
    format: 'rupiah',
  },
  { nama: 'median_tarif_rs', label: 'Median tarif RS', format: 'rupiah' },
  { nama: 'median_tarif_inacbg', label: 'Median tarif INA-CBG', format: 'rupiah' },
];

export async function ringkasanPerDpjp(koneksi: KoneksiKlaim): Promise<BarisHasil[]> {
  return koneksi.jalankan(SQL_RINGKASAN_DPJP);
}

export async function ringkasanPerBerkas(koneksi: KoneksiKlaim): Promise<BarisHasil[]> {
  return koneksi.jalankan(SQL_RINGKASAN_BERKAS);
}
