/**
 * Pemformatan nilai untuk tampilan. Semua dalam konvensi Indonesia.
 */
import type { BarisHasil } from '../db/types';
import type { KolomTabel } from '../ekspor/tabel';

const angka = new Intl.NumberFormat('id-ID');

export function formatRupiah(nilai: unknown): string {
  if (nilai === null || nilai === undefined || nilai === '') return '';
  const n = typeof nilai === 'number' ? nilai : Number(nilai);
  if (!Number.isFinite(n)) return String(nilai);
  return `Rp${angka.format(n)}`;
}

export function formatAngka(nilai: unknown): string {
  if (nilai === null || nilai === undefined || nilai === '') return '';
  const n = typeof nilai === 'number' ? nilai : Number(nilai);
  return Number.isFinite(n) ? angka.format(n) : String(nilai);
}

const NAMA_HARI: Record<string, string> = {
  Monday: 'Senin',
  Tuesday: 'Selasa',
  Wednesday: 'Rabu',
  Thursday: 'Kamis',
  Friday: 'Jumat',
  Saturday: 'Sabtu',
  Sunday: 'Minggu',
};

const NAMA_BULAN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

/** "2026-06-07" -> "7 Jun 2026". Nilai lain dikembalikan apa adanya. */
export function formatTanggal(nilai: unknown): string {
  if (typeof nilai !== 'string') return nilai === null || nilai === undefined ? '' : String(nilai);
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nilai);
  if (!cocok) return nilai;
  const [, tahun, bulan, hari] = cocok as unknown as [string, string, string, string];
  return `${Number(hari)} ${NAMA_BULAN[Number(bulan) - 1] ?? bulan} ${tahun}`;
}

/** Terjemahkan nama hari bahasa Inggris dari DuckDB. */
export function terjemahkanHari(nilai: unknown): string {
  const teks = String(nilai ?? '');
  return NAMA_HARI[teks] ?? teks;
}

export const LABEL_PTD: Record<string, string> = {
  '1': 'Rawat inap',
  '2': 'Rawat jalan',
};

export const LABEL_CARA_PULANG: Record<string, string> = {
  '1': 'Atas persetujuan dokter',
  '2': 'Dirujuk',
  '3': 'Atas permintaan sendiri',
  '4': 'Meninggal',
  '5': 'Lain-lain',
};

export const LABEL_CARA_MASUK: Record<string, string> = {
  gp: 'Rujukan FKTP',
  emd: 'Gawat darurat',
  outp: 'Rawat jalan',
  inp: 'Rawat inap',
  mp: 'Rujukan internal',
};

/** Format satu sel menurut petunjuk format pada kolom. */
export function formatSel(kolom: KolomTabel, baris: BarisHasil): string {
  const nilai = baris[kolom.nama] ?? null;
  if (nilai === null) return '—';

  if (kolom.nama === 'ptd') return LABEL_PTD[String(nilai)] ?? String(nilai);
  if (kolom.nama === 'cara_pulang') return LABEL_CARA_PULANG[String(nilai)] ?? String(nilai);
  if (kolom.nama === 'cara_masuk') return LABEL_CARA_MASUK[String(nilai)] ?? String(nilai);
  if (kolom.nama === 'nama_hari') return terjemahkanHari(nilai);

  switch (kolom.format) {
    case 'rupiah':
      return formatRupiah(nilai);
    case 'angka':
      return formatAngka(nilai);
    case 'tanggal':
      return formatTanggal(nilai);
    case 'daftar':
      return Array.isArray(nilai) ? nilai.join('; ') : String(nilai);
    default:
      return Array.isArray(nilai) ? nilai.join('; ') : String(nilai);
  }
}

export function formatDurasi(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} detik`;
}
