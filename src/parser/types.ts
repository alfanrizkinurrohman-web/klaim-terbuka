/**
 * Tipe bersama untuk parser E-Klaim.
 *
 * Catatan privasi: seluruh tipe di berkas ini hanya hidup di memori browser.
 * Tidak ada satu pun nilai di sini yang boleh dikirim ke jaringan.
 */

/** Tingkat keparahan sebuah temuan parser. */
export type TingkatPeringatan = 'galat' | 'peringatan' | 'info';

/**
 * Temuan parser/validator pada satu baris atau pada berkas secara keseluruhan.
 * `baris` adalah nomor baris di berkas (1 = header), atau null bila temuan
 * menyangkut berkas secara keseluruhan.
 */
export interface Peringatan {
  kode: string;
  tingkat: TingkatPeringatan;
  baris: number | null;
  pesan: string;
}

/** Nilai satu sel setelah normalisasi. */
export type NilaiKlaim = string | number | string[] | null;

/** Satu klaim = satu baris berkas, dengan nama kolom baku. */
export type Klaim = Record<string, NilaiKlaim> & {
  /** Nomor baris asal di berkas, untuk penelusuran balik di UI. */
  nomor_baris: number;
  /** Nama berkas asal, agar beberapa berkas bisa digabung dalam satu sesi. */
  berkas: string;
};

export interface RingkasanParsing {
  berkas: string;
  jumlahKolom: number;
  barisTotal: number;
  barisTerparse: number;
  barisGagal: number;
  barisKosongDilewati: number;
}

export interface HasilParsing {
  klaim: Klaim[];
  peringatan: Peringatan[];
  ringkasan: RingkasanParsing;
}
