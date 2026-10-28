/**
 * Normalisasi nilai sel sesuai tipe di config/column-map.yaml.
 */
import type { ColumnMap, DefinisiKolom } from './columnMap';
import type { NilaiKlaim, Peringatan } from './types';

const POLA_TANGGAL = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export interface HasilNormalisasi {
  nilai: Record<string, NilaiKlaim>;
  peringatan: Peringatan[];
}

function kosong(map: ColumnMap, mentah: string): boolean {
  return map.nilai_kosong.includes(mentah.trim());
}

/**
 * Ubah "DD/MM/YYYY" menjadi "YYYY-MM-DD" (format yang dimengerti DuckDB dan
 * aman untuk perbandingan sebagai string). Mengembalikan null bila tidak sah.
 */
export function uraikanTanggal(mentah: string): string | null {
  const cocok = POLA_TANGGAL.exec(mentah.trim());
  if (!cocok) return null;
  const [, dd, mm, yyyy] = cocok as unknown as [string, string, string, string];
  const hari = Number(dd);
  const bulan = Number(mm);
  const tahun = Number(yyyy);
  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return null;
  // Tolak tanggal yang tidak ada, mis. 31/02/2026.
  const d = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (d.getUTCFullYear() !== tahun || d.getUTCMonth() !== bulan - 1 || d.getUTCDate() !== hari) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

/** Selisih hari antara dua tanggal "YYYY-MM-DD". */
export function selisihHari(dari: string, sampai: string): number {
  const a = Date.parse(`${dari}T00:00:00Z`);
  const b = Date.parse(`${sampai}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Normalkan satu sel. `nomorBaris` hanya dipakai untuk pesan peringatan.
 */
export function normalkanSel(
  map: ColumnMap,
  kolom: DefinisiKolom,
  mentah: string,
  nomorBaris: number,
): HasilNormalisasi {
  const peringatan: Peringatan[] = [];
  const nilai: Record<string, NilaiKlaim> = {};
  const teks = mentah.trim();

  switch (kolom.tipe) {
    case 'mentah': {
      nilai[kolom.nama] = mentah;
      break;
    }

    case 'teks':
    case 'kode': {
      nilai[kolom.nama] = kosong(map, mentah) ? null : teks;
      break;
    }

    case 'enum': {
      if (kosong(map, mentah)) {
        nilai[kolom.nama] = null;
      } else if (kolom.enum?.includes(teks)) {
        nilai[kolom.nama] = teks;
      } else {
        nilai[kolom.nama] = teks;
        peringatan.push({
          kode: 'NILAI_DI_LUAR_DAFTAR',
          tingkat: 'peringatan',
          baris: nomorBaris,
          pesan:
            `Kolom ${kolom.sumber} bernilai "${teks}", di luar nilai yang dikenali ` +
            `(${kolom.enum?.join(', ')}). Nilai tetap disimpan apa adanya.`,
        });
      }
      break;
    }

    case 'bilangan':
    case 'desimal': {
      if (kosong(map, mentah)) {
        nilai[kolom.nama] = null;
        break;
      }
      const n = Number(teks);
      if (!Number.isFinite(n)) {
        nilai[kolom.nama] = null;
        peringatan.push({
          kode: 'ANGKA_TIDAK_SAH',
          tingkat: 'peringatan',
          baris: nomorBaris,
          pesan: `Kolom ${kolom.sumber} bernilai "${teks}" yang bukan angka; dianggap kosong.`,
        });
        break;
      }
      if (kolom.tipe === 'bilangan' && !Number.isInteger(n)) {
        peringatan.push({
          kode: 'ANGKA_BUKAN_BULAT',
          tingkat: 'peringatan',
          baris: nomorBaris,
          pesan: `Kolom ${kolom.sumber} bernilai "${teks}", seharusnya bilangan bulat.`,
        });
      }
      nilai[kolom.nama] = n;
      break;
    }

    case 'tanggal': {
      if (kosong(map, mentah)) {
        nilai[kolom.nama] = null;
        break;
      }
      const t = uraikanTanggal(teks);
      if (t === null) {
        nilai[kolom.nama] = null;
        peringatan.push({
          kode: 'TANGGAL_TIDAK_SAH',
          tingkat: 'peringatan',
          baris: nomorBaris,
          pesan:
            `Kolom ${kolom.sumber} bernilai "${teks}" yang bukan tanggal ` +
            `${map.format_tanggal} yang sah; dianggap kosong.`,
        });
        break;
      }
      nilai[kolom.nama] = t;
      break;
    }

    case 'daftar_kode': {
      // "-" dan "" sama-sama berarti daftar kosong; keduanya dipakai di kolom
      // yang berbeda pada berkas yang sama.
      nilai[kolom.nama] = kosong(map, mentah)
        ? []
        : teks
            .split(map.pemisah_daftar)
            .map((k) => k.trim())
            .filter((k) => k !== '');
      break;
    }

    case 'majemuk': {
      const bagian = kosong(map, mentah) ? [] : teks.split(map.pemisah_daftar);
      const subField = kolom.sub_field ?? [];
      subField.forEach((sf, i) => {
        const v = bagian[i]?.trim() ?? '';
        nilai[sf.nama] = v === '' ? null : v;
      });
      if (bagian.length > subField.length) {
        peringatan.push({
          kode: 'MAJEMUK_SEGMEN_BERLEBIH',
          tingkat: 'peringatan',
          baris: nomorBaris,
          pesan:
            `Kolom ${kolom.sumber} berisi ${bagian.length} segmen, ` +
            `padahal hanya ${subField.length} yang dikenali. Segmen sisanya diabaikan.`,
        });
      }
      break;
    }
  }

  return { nilai, peringatan };
}
