/**
 * Pengolahan kolom C2.
 *
 * C2 berisi 14 sub-field dipisah "#". Penomoran di berkas ini 1-BASED, yaitu
 * posisi setelah `split("#")` ditambah satu. (Spesifikasi awal proyek memakai
 * penomoran 0-based; lihat docs/format-eklaim.md bagian 5.1.)
 *
 * PRIVASI — yang terpenting di berkas ini:
 * sub-field 12 dan 13 dapat memuat respons registri TB yang berisi NAMA dan
 * NIK pasien. Keduanya DIBUANG sebelum pengolahan apa pun. Tidak ada jalur kode
 * yang mem-parse, menyimpan, atau menampilkannya.
 */
import type { NilaiKlaim, Peringatan } from './types';

export const C2_JUMLAH_SUBFIELD = 14;
export const C2_PEMISAH = '#';

/** Posisi sub-field, 1-based. */
export const SF = {
  NAIK_KELAS: 2,
  KELAS_TUJUAN: 3,
  SELISIH_BIAYA: 5,
  WAKTU_GROUPING: 7,
  /** Dibuang: dapat memuat identitas. */
  SENSITIF_A: 12,
  /** Dibuang: respons registri TB (nama + NIK). */
  REGISTRI_TB: 13,
  JSON_KLINIS: 14,
} as const;

/** Sub-field yang dibuang tanpa pernah dibaca isinya. */
export const SF_DIBUANG: readonly number[] = [SF.SENSITIF_A, SF.REGISTRI_TB];

/**
 * Buang sub-field sensitif dari string C2 mentah.
 *
 * Dipanggil SEBELUM apa pun yang lain. Nilai diganti string kosong sehingga
 * posisi sub-field lain tidak bergeser.
 */
export function buangSubFieldSensitif(c2: string): string {
  const bagian = c2.split(C2_PEMISAH);
  for (const posisi of SF_DIBUANG) {
    if (bagian.length >= posisi) bagian[posisi - 1] = '';
  }
  return bagian.join(C2_PEMISAH);
}

function ambil(bagian: string[], posisi1Based: number): string {
  return bagian[posisi1Based - 1] ?? '';
}

function keBilangan(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '' || s === '-' || s === 'None' || s === 'null' || s === 'na') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function keTeks(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function keFlag(v: unknown): string | null {
  const s = keTeks(v);
  if (s === null) return '0'; // "" berarti tidak dipakai (terverifikasi pada sampel)
  return s === '1' ? '1' : '0';
}

function rekam(o: unknown): Record<string, unknown> | null {
  return typeof o === 'object' && o !== null && !Array.isArray(o)
    ? (o as Record<string, unknown>)
    : null;
}

export interface HasilC2 {
  /** Kolom turunan siap dimasukkan ke tabel `klaim`. */
  turunan: Record<string, NilaiKlaim>;
  peringatan: Peringatan[];
}

/**
 * Uraikan satu nilai C2 menjadi kolom turunan.
 *
 * Toleran terhadap kerusakan: JSON yang gagal di-parse menghasilkan peringatan
 * pada baris tersebut, bukan menggagalkan seluruh berkas.
 */
export function uraikanC2(c2mentah: string, nomorBaris: number): HasilC2 {
  const peringatan: Peringatan[] = [];
  const turunan: Record<string, NilaiKlaim> = {
    naik_kelas: null,
    kelas_tujuan: null,
    waktu_grouping: null,
    cara_masuk: null,
    sistole: null,
    diastole: null,
    selisih_biaya_nilai: null,
    selisih_biaya_pembayar: null,
    ventilator_digunakan: null,
    persalinan_gravida: null,
    persalinan_partus: null,
    persalinan_abortus: null,
    persalinan_usia_kehamilan: null,
    persalinan_onset_kontraksi: null,
    persalinan_metode: null,
    apgar_score: null,
    kantong_darah: null,
    alteplase_ind: null,
    dializer_single_use: null,
  };

  if (c2mentah.trim() === '') {
    peringatan.push({
      kode: 'C2_KOSONG',
      tingkat: 'peringatan',
      baris: nomorBaris,
      pesan: 'Kolom C2 kosong; data klinis tambahan tidak tersedia untuk klaim ini.',
    });
    return { turunan, peringatan };
  }

  const bagian = buangSubFieldSensitif(c2mentah).split(C2_PEMISAH);
  if (bagian.length !== C2_JUMLAH_SUBFIELD) {
    peringatan.push({
      kode: 'C2_JUMLAH_SUBFIELD',
      tingkat: 'peringatan',
      baris: nomorBaris,
      pesan:
        `Kolom C2 berisi ${bagian.length} sub-field, seharusnya ${C2_JUMLAH_SUBFIELD}. ` +
        'Sub-field yang masih bisa dibaca tetap diambil.',
    });
  }

  const naikKelas = ambil(bagian, SF.NAIK_KELAS).trim();
  turunan['naik_kelas'] = naikKelas === '1' ? '1' : naikKelas === '0' ? '0' : null;
  turunan['kelas_tujuan'] = keTeks(ambil(bagian, SF.KELAS_TUJUAN));
  turunan['waktu_grouping'] = keTeks(ambil(bagian, SF.WAKTU_GROUPING));

  const jsonMentah = ambil(bagian, SF.JSON_KLINIS).trim();
  if (jsonMentah === '') {
    peringatan.push({
      kode: 'C2_JSON_KOSONG',
      tingkat: 'peringatan',
      baris: nomorBaris,
      pesan: 'Sub-field JSON pada C2 kosong; data klinis tambahan tidak tersedia.',
    });
    return { turunan, peringatan };
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = rekam(JSON.parse(jsonMentah));
    if (data === null) {
      peringatan.push({
        kode: 'C2_JSON_BUKAN_OBJEK',
        tingkat: 'peringatan',
        baris: nomorBaris,
        pesan: 'Sub-field JSON pada C2 bukan objek; diabaikan untuk klaim ini.',
      });
      return { turunan, peringatan };
    }
  } catch (e) {
    peringatan.push({
      kode: 'C2_JSON_RUSAK',
      tingkat: 'peringatan',
      baris: nomorBaris,
      pesan:
        `Sub-field JSON pada C2 gagal dibaca (${(e as Error).message}). ` +
        'Kolom turunan untuk klaim ini dikosongkan; kolom lain tetap diproses.',
    });
    return { turunan, peringatan };
  }

  turunan['cara_masuk'] = keTeks(data['cara_masuk']);
  turunan['sistole'] = keBilangan(data['sistole']);
  turunan['diastole'] = keBilangan(data['diastole']);
  turunan['apgar_score'] = keTeks(data['apgar_score']);
  turunan['kantong_darah'] = keBilangan(data['kantong_darah']);
  turunan['alteplase_ind'] = keFlag(data['alteplase_ind']);
  turunan['dializer_single_use'] = keTeks(data['dializer_single_use']);

  const selisih = rekam(data['selisih_biaya']);
  if (selisih) {
    turunan['selisih_biaya_nilai'] = keBilangan(selisih['nilai']);
    turunan['selisih_biaya_pembayar'] = keTeks(selisih['pembayar']);
  }

  const ventilator = rekam(data['ventilator']);
  if (ventilator) {
    turunan['ventilator_digunakan'] = keFlag(ventilator['use_ind']);
  }

  const persalinan = rekam(data['persalinan']);
  if (persalinan) {
    turunan['persalinan_gravida'] = keBilangan(persalinan['gravida']);
    turunan['persalinan_partus'] = keBilangan(persalinan['partus']);
    turunan['persalinan_abortus'] = keBilangan(persalinan['abortus']);
    turunan['persalinan_usia_kehamilan'] = keBilangan(persalinan['usia_kehamilan']);
    turunan['persalinan_onset_kontraksi'] = keTeks(persalinan['onset_kontraksi']);
    const delivery = persalinan['delivery'];
    if (Array.isArray(delivery)) {
      const metode = delivery
        .map((d) => keTeks(rekam(d)?.['delivery_method']))
        .filter((m): m is string => m !== null);
      turunan['persalinan_metode'] = metode;
    }
  }

  return { turunan, peringatan };
}
