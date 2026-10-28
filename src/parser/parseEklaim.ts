/**
 * Parser berkas ekspor E-Klaim.
 *
 * Seluruh pemrosesan terjadi di memori. Tidak ada I/O jaringan di berkas ini
 * maupun di modul yang dipanggilnya.
 */
import { buangSubFieldSensitif, uraikanC2 } from './c2';
import type { ColumnMap } from './columnMap';
import { dekodeBerkas, pecahBaris } from './decode';
import { normalkanSel } from './normalize';
import type { HasilParsing, Klaim, NilaiKlaim, Peringatan } from './types';

export interface OpsiParsing {
  /** Nama berkas, dipakai untuk pelabelan dan pesan peringatan. */
  namaBerkas?: string;
  /** Hentikan setelah sekian baris gagal berturut-turut. 0 = tanpa batas. */
  batasBarisGagal?: number;
}

interface PemetaanHeader {
  /** Indeks kolom di berkas untuk tiap nama kolom sumber. */
  indeks: Map<string, number>;
  peringatan: Peringatan[];
  /** True bila berkas tidak layak diproses lebih lanjut. */
  gagal: boolean;
}

function petakanHeader(map: ColumnMap, header: string[]): PemetaanHeader {
  const peringatan: Peringatan[] = [];
  const diharapkan = map.kolom.map((k) => k.sumber);
  const indeks = new Map<string, number>();
  header.forEach((nama, i) => {
    const bersih = nama.trim();
    if (!indeks.has(bersih)) indeks.set(bersih, i);
  });

  const hilang = diharapkan.filter((s) => !indeks.has(s));
  const berlebih = header.map((h) => h.trim()).filter((h) => !diharapkan.includes(h));

  if (header.length === 1) {
    peringatan.push({
      kode: 'HEADER_TANPA_PEMISAH',
      tingkat: 'galat',
      baris: 1,
      pesan:
        'Baris pertama tidak memuat pemisah TAB. Berkas ini sepertinya bukan ekspor ' +
        'E-Klaim (atau sudah diubah formatnya, misalnya disimpan ulang sebagai CSV).',
    });
    return { indeks, peringatan, gagal: true };
  }

  if (hilang.length > 0) {
    peringatan.push({
      kode: 'KOLOM_HILANG',
      tingkat: 'galat',
      baris: 1,
      pesan:
        `Berkas kekurangan ${hilang.length} kolom yang diperlukan: ` +
        `${hilang.slice(0, 10).join(', ')}${hilang.length > 10 ? ', ...' : ''}. ` +
        'Periksa apakah versi E-Klaim berkas ini sama dengan yang didukung ' +
        `(column-map versi ${map.versi}).`,
    });
    return { indeks, peringatan, gagal: true };
  }

  if (header.length !== diharapkan.length) {
    peringatan.push({
      kode: 'JUMLAH_KOLOM_BERBEDA',
      tingkat: 'peringatan',
      baris: 1,
      pesan:
        `Berkas memiliki ${header.length} kolom, sedangkan yang dikenali ` +
        `${diharapkan.length}. Kolom tambahan diabaikan: ` +
        `${berlebih.slice(0, 10).join(', ')}${berlebih.length > 10 ? ', ...' : ''}.`,
    });
  }

  const urutanSama = diharapkan.every((s, i) => header[i]?.trim() === s);
  if (!urutanSama) {
    peringatan.push({
      kode: 'URUTAN_KOLOM_BERBEDA',
      tingkat: 'peringatan',
      baris: 1,
      pesan:
        'Urutan kolom berbeda dari ekspor E-Klaim yang biasa. Kolom dicocokkan ' +
        'berdasarkan nama, jadi data tetap terbaca dengan benar.',
    });
  }

  return { indeks, peringatan, gagal: false };
}

/**
 * Parse isi berkas E-Klaim menjadi daftar klaim dengan nama kolom baku.
 *
 * Tidak pernah melempar galat karena isi berkas; semua masalah dilaporkan
 * lewat `peringatan` agar koder bisa melihat apa yang salah.
 */
export function parseEklaim(
  bytes: Uint8Array,
  map: ColumnMap,
  opsi: OpsiParsing = {},
): HasilParsing {
  const namaBerkas = opsi.namaBerkas ?? '(tanpa nama)';
  const peringatan: Peringatan[] = [];

  const { teks, peringatan: peringatanDekode } = dekodeBerkas(bytes);
  peringatan.push(...peringatanDekode);

  const ringkasanKosong = {
    berkas: namaBerkas,
    jumlahKolom: 0,
    barisTotal: 0,
    barisTerparse: 0,
    barisGagal: 0,
    barisKosongDilewati: 0,
  };

  if (teks === '') {
    return { klaim: [], peringatan, ringkasan: ringkasanKosong };
  }

  const pecahan = pecahBaris(teks);
  peringatan.push(...pecahan.peringatan);

  const barisHeader = pecahan.baris[0];
  if (!barisHeader) {
    peringatan.push({
      kode: 'TANPA_HEADER',
      tingkat: 'galat',
      baris: null,
      pesan: 'Berkas tidak memuat baris apa pun selain baris kosong.',
    });
    return { klaim: [], peringatan, ringkasan: ringkasanKosong };
  }

  const header = barisHeader.isi.split(map.pemisah_kolom);
  const pemetaan = petakanHeader(map, header);
  peringatan.push(...pemetaan.peringatan);
  if (pemetaan.gagal) {
    return {
      klaim: [],
      peringatan,
      ringkasan: { ...ringkasanKosong, jumlahKolom: header.length },
    };
  }

  const barisData = pecahan.baris.slice(1);
  const klaim: Klaim[] = [];
  let barisGagal = 0;
  let gagalBerturut = 0;

  for (const { nomor, isi } of barisData) {
    const sel = isi.split(map.pemisah_kolom);

    if (sel.length !== header.length) {
      barisGagal += 1;
      gagalBerturut += 1;
      peringatan.push({
        kode: 'JUMLAH_FIELD_BERBEDA',
        tingkat: 'galat',
        baris: nomor,
        pesan:
          `Baris ini berisi ${sel.length} kolom, seharusnya ${header.length}. ` +
          'Baris dilewati. Penyebab tersering: ada karakter TAB di dalam salah satu ' +
          'isian, atau berkas terpotong.',
      });
      if (opsi.batasBarisGagal && gagalBerturut >= opsi.batasBarisGagal) {
        peringatan.push({
          kode: 'TERLALU_BANYAK_BARIS_GAGAL',
          tingkat: 'galat',
          baris: nomor,
          pesan:
            `${gagalBerturut} baris gagal berturut-turut; pemrosesan dihentikan. ` +
            'Periksa apakah berkas ini benar ekspor E-Klaim yang utuh.',
        });
        break;
      }
      continue;
    }
    gagalBerturut = 0;

    const baris: Record<string, NilaiKlaim> = {};
    for (const kolom of map.kolom) {
      const i = pemetaan.indeks.get(kolom.sumber);
      const mentah = i === undefined ? '' : (sel[i] ?? '');

      if (kolom.pengolahan_khusus === 'c2') {
        // PRIVASI: sub-field sensitif dibuang sebelum nilai disimpan di mana pun.
        const aman = buangSubFieldSensitif(mentah);
        baris[kolom.nama] = aman;
        const hasilC2 = uraikanC2(aman, nomor);
        Object.assign(baris, hasilC2.turunan);
        peringatan.push(...hasilC2.peringatan);
        continue;
      }

      const hasil = normalkanSel(map, kolom, mentah, nomor);
      Object.assign(baris, hasil.nilai);
      peringatan.push(...hasil.peringatan);
    }

    klaim.push({ ...baris, nomor_baris: nomor, berkas: namaBerkas });
  }

  return {
    klaim,
    peringatan,
    ringkasan: {
      berkas: namaBerkas,
      jumlahKolom: header.length,
      barisTotal: barisData.length,
      barisTerparse: klaim.length,
      barisGagal,
      barisKosongDilewati: pecahan.barisKosongDilewati,
    },
  };
}
