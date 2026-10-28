/**
 * Dekode byte berkas menjadi teks, dan pemecahan baris.
 *
 * Berkas E-Klaim yang sah berupa ASCII dengan akhir baris CRLF. Berkas yang
 * menyimpang tetap diusahakan terbaca, tetapi selalu menghasilkan peringatan —
 * koder perlu tahu bahwa berkasnya tidak sesuai pola biasa.
 */
import type { Peringatan } from './types';

export interface HasilDekode {
  teks: string;
  peringatan: Peringatan[];
}

const BOM_UTF8 = [0xef, 0xbb, 0xbf];
const BOM_UTF16LE = [0xff, 0xfe];
const BOM_UTF16BE = [0xfe, 0xff];

function diawali(bytes: Uint8Array, pola: number[]): boolean {
  return pola.every((b, i) => bytes[i] === b);
}

export function dekodeBerkas(bytes: Uint8Array): HasilDekode {
  const daftar: Peringatan[] = [];

  if (bytes.length === 0) {
    return {
      teks: '',
      peringatan: [
        { kode: 'BERKAS_KOSONG', tingkat: 'galat', baris: null, pesan: 'Berkas kosong (0 byte).' },
      ],
    };
  }

  if (diawali(bytes, BOM_UTF16LE) || diawali(bytes, BOM_UTF16BE)) {
    const besarDulu = diawali(bytes, BOM_UTF16BE);
    daftar.push({
      kode: 'ENCODING_UTF16',
      tingkat: 'peringatan',
      baris: null,
      pesan:
        'Berkas ber-encoding UTF-16, bukan ASCII seperti ekspor E-Klaim pada umumnya. ' +
        'Berkas tetap dibaca, tetapi mohon pastikan berkas ini benar hasil ekspor E-Klaim.',
    });
    const teks = new TextDecoder(besarDulu ? 'utf-16be' : 'utf-16le').decode(bytes.slice(2));
    return { teks, peringatan: daftar };
  }

  let isi = bytes;
  if (diawali(bytes, BOM_UTF8)) {
    daftar.push({
      kode: 'ENCODING_BOM_UTF8',
      tingkat: 'peringatan',
      baris: null,
      pesan: 'Berkas diawali BOM UTF-8. BOM diabaikan.',
    });
    isi = bytes.slice(3);
  }

  const adaNonAscii = isi.some((b) => b > 0x7f);
  if (!adaNonAscii) {
    return { teks: new TextDecoder('ascii').decode(isi), peringatan: daftar };
  }

  // Ada byte di luar ASCII. Coba UTF-8 ketat dulu, lalu mundur ke Latin-1 agar
  // berkas tetap bisa diperiksa daripada ditolak mentah-mentah.
  try {
    const teks = new TextDecoder('utf-8', { fatal: true }).decode(isi);
    daftar.push({
      kode: 'ENCODING_BUKAN_ASCII',
      tingkat: 'peringatan',
      baris: null,
      pesan:
        'Berkas memuat karakter di luar ASCII dan dibaca sebagai UTF-8. ' +
        'Ekspor E-Klaim seharusnya ASCII murni — periksa apakah berkas pernah ' +
        'dibuka dan disimpan ulang oleh aplikasi lain.',
    });
    return { teks, peringatan: daftar };
  } catch {
    daftar.push({
      kode: 'ENCODING_TIDAK_DIKENALI',
      tingkat: 'galat',
      baris: null,
      pesan:
        'Berkas memuat byte yang bukan ASCII maupun UTF-8 yang sah. Berkas dibaca ' +
        'sebagai Latin-1 sebagai upaya terakhir; sebagian karakter dapat salah baca.',
    });
    return { teks: new TextDecoder('latin1').decode(isi), peringatan: daftar };
  }
}

export interface HasilPemecahanBaris {
  /** Baris berisi, beserta nomor baris aslinya di berkas (1-based). */
  baris: Array<{ nomor: number; isi: string }>;
  peringatan: Peringatan[];
  barisKosongDilewati: number;
}

/**
 * Pecah teks menjadi baris. CRLF adalah bentuk yang benar; LF atau CR tunggal
 * tetap diterima dengan peringatan. Baris kosong dilewati.
 */
export function pecahBaris(teks: string): HasilPemecahanBaris {
  const daftar: Peringatan[] = [];

  const jumlahCrlf = (teks.match(/\r\n/g) ?? []).length;
  const jumlahLf = (teks.match(/\n/g) ?? []).length - jumlahCrlf;
  const jumlahCr = (teks.match(/\r/g) ?? []).length - jumlahCrlf;
  if (jumlahCrlf === 0 && (jumlahLf > 0 || jumlahCr > 0)) {
    daftar.push({
      kode: 'AKHIR_BARIS_BUKAN_CRLF',
      tingkat: 'peringatan',
      baris: null,
      pesan:
        'Berkas tidak memakai akhir baris CRLF seperti ekspor E-Klaim. ' +
        'Berkas tetap dibaca.',
    });
  } else if (jumlahLf > 0 || jumlahCr > 0) {
    daftar.push({
      kode: 'AKHIR_BARIS_CAMPURAN',
      tingkat: 'peringatan',
      baris: null,
      pesan:
        `Berkas memakai campuran akhir baris (CRLF: ${jumlahCrlf}, LF: ${jumlahLf}, ` +
        `CR: ${jumlahCr}). Berkas tetap dibaca, tetapi ini pertanda berkas pernah diubah.`,
    });
  }

  const semua = teks.split(/\r\n|\n|\r/);
  const baris: Array<{ nomor: number; isi: string }> = [];
  let kosong = 0;
  for (const [i, isi] of semua.entries()) {
    if (isi.trim() === '') {
      // Baris kosong di akhir berkas itu normal; yang di tengah patut dilaporkan.
      if (i < semua.length - 1 && semua.slice(i + 1).some((l) => l.trim() !== '')) {
        kosong += 1;
        daftar.push({
          kode: 'BARIS_KOSONG',
          tingkat: 'peringatan',
          baris: i + 1,
          pesan: 'Baris kosong di tengah berkas, dilewati.',
        });
      }
      continue;
    }
    baris.push({ nomor: i + 1, isi });
  }

  return { baris, peringatan: daftar, barisKosongDilewati: kosong };
}
