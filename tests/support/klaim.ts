/**
 * Pembuat klaim uji yang ringkas dan eksplisit.
 *
 * Berbeda dari generator di tests/fixtures/ yang membangun BERKAS lengkap untuk
 * menguji parser, helper ini membangun BARIS tabel langsung supaya test aturan
 * bisa mengatur satu kolom saja dan jelas terbaca apa yang membuat sebuah
 * aturan memicu.
 *
 * Semua nilai sintetis. Nama dan nomor memakai pola "SINTETIS" agar tidak
 * mungkin tertukar dengan data nyata.
 */
import type { Klaim, NilaiKlaim } from '../../src/parser/types';

/** Nilai bawaan: satu klaim rawat inap yang tidak memicu aturan apa pun. */
function dasar(nomorBaris: number): Record<string, NilaiKlaim> {
  const komponen = {
    komp_prosedur_non_bedah: 25_000,
    komp_prosedur_bedah: 0,
    komp_konsultasi: 110_000,
    komp_tenaga_ahli: 0,
    komp_keperawatan: 95_000,
    komp_penunjang: 0,
    komp_radiologi: 0,
    komp_laboratorium: 84_000,
    komp_pelayanan_darah: 0,
    komp_rehabilitasi: 0,
    komp_kamar_akomodasi: 555_000,
    komp_rawat_intensif: 0,
    komp_obat: 231_000,
    komp_alkes: 0,
    komp_bmhp: 70_000,
    komp_sewa_alat: 0,
    komp_obat_kronis: 0,
    komp_obat_kemo: 0,
  };
  const tarifRs = Object.values(komponen).reduce((a, b) => a + b, 0);
  const tarifInacbg = 1_800_000;

  return {
    kode_rs: '0000000',
    kelas_rs: 'C',
    kelas_rawat: '3',
    kode_tarif: 'CS',
    // 1 Juni 2026 adalah hari Senin; dipilih agar aturan hari libur tidak memicu.
    ptd: '1',
    tanggal_masuk: '2026-06-01',
    tanggal_pulang: '2026-06-03',
    tanggal_lahir: '1986-03-14',
    berat_lahir_gram: 0,
    jenis_kelamin: '2',
    cara_pulang: '1',
    diagnosis_inacbg: ['A01.0'],
    prosedur_inacbg: [],
    adl1: null,
    adl2: null,
    input_sp: null,
    input_sr: null,
    input_si: null,
    input_sd: null,
    kode_inacbg: 'M-4-16-II',
    kode_subacute: null,
    kode_chronic: null,
    kode_sp: null,
    kode_sr: null,
    kode_si: null,
    kode_sd: null,
    deskripsi_inacbg: 'DESKRIPSI SINTETIS',
    tarif_inacbg: tarifInacbg,
    tarif_subacute: 0,
    tarif_chronic: 0,
    deskripsi_sp: null,
    tarif_sp: 0,
    deskripsi_sr: null,
    tarif_sr: 0,
    deskripsi_si: null,
    tarif_si: 0,
    deskripsi_sd: null,
    tarif_sd: 0,
    total_tarif: tarifInacbg,
    tarif_rs: tarifRs,
    tarif_poli_eksekutif: 0,
    los: 3,
    icu_indikator: '0',
    icu_los: 0,
    jam_ventilator: 0,
    nama_pasien: `SINTETIS ${String(nomorBaris).padStart(4, '0')}`,
    mrn: String(100_000 + nomorBaris),
    umur_tahun: 40,
    umur_hari: 14_689,
    dpjp: 'SNT-01',
    sep: `9999S${String(nomorBaris).padStart(7, '0')}X999999`,
    nomor_kartu: String(8_000_000_000_000 + nomorBaris),
    payor_kode: '3',
    payor_nama: 'JKN',
    coder_id: 'SNTKD-01',
    coder_ref: '0000000000000001',
    coder_id_2: 'SNTKD-01',
    versi_inacbg: '5.10.8.202606251251',
    versi_grouper: '4',
    c1: String(100_000 + nomorBaris),
    c2: '',
    c3: '1',
    c4: '0'.repeat(32),
    ...komponen,
    diagnosis_idrg: ['A01.0'],
    prosedur_idrg: [],
    idrg_mdc_nomor: '16',
    idrg_mdc_deskripsi: 'MDC SINTETIS',
    idrg_drg_kode: '1670119',
    idrg_drg_deskripsi: 'DRG SINTETIS',
    idrg_cost_weight: 0.36,
    idrg_sa_cost_weight: null,
    idrg_ch_cost_weight: null,
    idrg_top_up: null,
    idrg_total_cost_weight: 0.36,
    idrg_nbr: 8_037_060,
    idrg_total_tarif: 2_893_342,
    idrg_versi_grouper: '1.0.33',
    idrg_versi_logic: '0.2.1831.202606291712',
    naik_kelas: '0',
    kelas_tujuan: null,
    waktu_grouping: '2026-06-10 10:00:00',
    cara_masuk: 'gp',
    sistole: 120,
    diastole: 80,
    selisih_biaya_nilai: 0,
    selisih_biaya_pembayar: null,
    ventilator_digunakan: '0',
    persalinan_gravida: null,
    persalinan_partus: null,
    persalinan_abortus: null,
    persalinan_usia_kehamilan: null,
    persalinan_onset_kontraksi: null,
    persalinan_metode: null,
    apgar_score: null,
    kantong_darah: 0,
    alteplase_ind: '0',
    dializer_single_use: 'na',
  };
}

/**
 * Bangun satu klaim uji. Kolom yang diubah lewat `ubah` menimpa nilai bawaan.
 *
 * Perhatian: mengubah komponen biaya tidak otomatis menyesuaikan tarif_rs.
 * Gunakan `dengan` bila ingin tarif_rs tetap konsisten.
 */
export function klaimUji(
  nomorBaris: number,
  ubah: Record<string, NilaiKlaim> = {},
  berkas = 'uji.TXT',
): Klaim {
  return { ...dasar(nomorBaris), ...ubah, nomor_baris: nomorBaris, berkas };
}

/** 18 nama kolom komponen biaya, untuk test yang perlu menjumlahkannya. */
export const KOMPONEN_BIAYA = Object.keys(dasar(1)).filter((k) => k.startsWith('komp_'));

/**
 * Seperti klaimUji, tetapi menyesuaikan tarif_rs agar tetap sama dengan jumlah
 * 18 komponen setelah perubahan diterapkan.
 */
export function klaimUjiKonsisten(
  nomorBaris: number,
  ubah: Record<string, NilaiKlaim> = {},
  berkas = 'uji.TXT',
): Klaim {
  const k = klaimUji(nomorBaris, ubah, berkas);
  const jumlah = KOMPONEN_BIAYA.reduce((t, nama) => {
    const v = k[nama];
    return t + (typeof v === 'number' ? v : 0);
  }, 0);
  return { ...k, tarif_rs: jumlah };
}
