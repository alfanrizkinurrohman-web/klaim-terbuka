/**
 * Pembongkaran berkas ZIP di peramban.
 *
 * Tim casemix sering menerima ekspor E-Klaim dalam satu ZIP. Pembongkaran
 * dilakukan di memori dengan fflate; tidak ada berkas yang ditulis ke disk dan
 * tidak ada yang dikirim ke jaringan.
 */
import { unzipSync } from 'fflate';

import type { Peringatan } from '../parser/types';

export interface BerkasMasuk {
  nama: string;
  bytes: Uint8Array;
}

export interface HasilBongkar {
  berkas: BerkasMasuk[];
  peringatan: Peringatan[];
}

const POLA_TXT = /\.txt$/i;
const POLA_ZIP = /\.zip$/i;

/** Batas kewajaran agar ZIP yang isinya meledak tidak menghabiskan memori. */
export const BATAS_TOTAL_BYTE = 512 * 1024 * 1024;

function adalahZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/**
 * Ubah daftar berkas yang dipilih pengguna menjadi daftar berkas TXT siap
 * di-parse. Berkas ZIP dibongkar satu tingkat.
 */
export function bongkarBerkas(masuk: BerkasMasuk[]): HasilBongkar {
  const berkas: BerkasMasuk[] = [];
  const peringatan: Peringatan[] = [];
  let totalByte = 0;

  const tambah = (nama: string, bytes: Uint8Array, dariZip: string | null): void => {
    totalByte += bytes.byteLength;
    if (totalByte > BATAS_TOTAL_BYTE) {
      peringatan.push({
        kode: 'TERLALU_BESAR',
        tingkat: 'galat',
        baris: null,
        pesan:
          `Total isi berkas melampaui ${Math.round(BATAS_TOTAL_BYTE / 1024 / 1024)} MB. ` +
          'Berkas sisanya tidak diproses. Coba unggah per berkas.',
      });
      return;
    }
    berkas.push({ nama: dariZip ? `${dariZip}:${nama}` : nama, bytes });
  };

  for (const b of masuk) {
    if (POLA_ZIP.test(b.nama) || adalahZip(b.bytes)) {
      let isi: Record<string, Uint8Array>;
      try {
        isi = unzipSync(b.bytes);
      } catch (e) {
        peringatan.push({
          kode: 'ZIP_RUSAK',
          tingkat: 'galat',
          baris: null,
          pesan: `Berkas ZIP "${b.nama}" tidak bisa dibuka: ${(e as Error).message}`,
        });
        continue;
      }

      const txt = Object.entries(isi).filter(
        ([nama, data]) => POLA_TXT.test(nama) && data.byteLength > 0,
      );
      if (txt.length === 0) {
        peringatan.push({
          kode: 'ZIP_TANPA_TXT',
          tingkat: 'galat',
          baris: null,
          pesan: `Berkas ZIP "${b.nama}" tidak memuat berkas .TXT.`,
        });
        continue;
      }
      // Nama berkas di dalam ZIP bisa memuat folder; ambil nama berkasnya saja.
      for (const [nama, data] of txt) {
        tambah(nama.split('/').pop() ?? nama, data, b.nama);
      }
      continue;
    }

    if (!POLA_TXT.test(b.nama)) {
      peringatan.push({
        kode: 'BUKAN_TXT',
        tingkat: 'peringatan',
        baris: null,
        pesan:
          `Berkas "${b.nama}" bukan .TXT maupun .ZIP dan tetap dicoba diproses. ` +
          'Ekspor E-Klaim berupa berkas .TXT.',
      });
    }
    tambah(b.nama, b.bytes, null);
  }

  return { berkas, peringatan };
}
