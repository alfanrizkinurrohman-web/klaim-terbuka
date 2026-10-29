/**
 * Tindakan ekspor yang dipakai UI.
 *
 * Semua jalur ekspor melewati siapkanTabel(), jadi penyamaran identitas tidak
 * mungkin terlewat.
 */
import type { BarisHasil } from '../db/types';
import type { ColumnMap } from '../parser/columnMap';
import type { HasilAturan } from '../rules/engine';
import { CATATAN_RINGKASAN_DPJP, KOLOM_RINGKASAN_DPJP } from '../rules/ringkasan';
import { csvKeBytes, tabelKeCsv } from './csv';
import { siapkanTabel } from './tabel';
import type { TabelEkspor } from './tabel';
import { capWaktu, namaBerkasAman, unduhBytes } from './unduh';
import { TIPE_MIME_XLSX, tabelKeXlsx } from './xlsx';

const MIME_CSV = 'text/csv;charset=utf-8';

/** Catatan yang selalu disertakan, agar berkas ekspor tidak lepas konteks. */
function catatanAturan(h: HasilAturan): string[] {
  const catatan = [
    `Aturan: ${h.aturan.judul} (${h.aturan.id})`,
    `Status: ${h.aturan.status}${h.aturan.status === 'draft' ? ' — perlu validasi koder' : ''}`,
    `Sumber regulasi: ${h.aturan.sumber_regulasi ?? 'belum dicantumkan'}`,
    `Sifat: ${h.aturan.tingkat === 'informasi' ? 'informasi, bukan kesalahan' : 'perlu diperiksa'}`,
    `Jumlah temuan: ${h.jumlah}`,
    `Bukti yang perlu diperiksa: ${h.aturan.bukti_yang_perlu_diperiksa.join(' | ')}`,
    `Catatan etika: ${h.aturan.catatan_etika.replace(/\s+/g, ' ').trim()}`,
  ];
  if (Object.keys(h.parameterTerpakai).length > 0) {
    catatan.push(
      `Parameter: ${Object.entries(h.parameterTerpakai)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}`,
    );
  }
  for (const c of h.catatan) catatan.push(c.replace(/\s+/g, ' ').trim());
  return catatan;
}

export function tabelDariAturan(
  h: HasilAturan,
  map: ColumnMap,
  bukaSamaran: boolean,
): TabelEkspor {
  return siapkanTabel(h.aturan.id, h.aturan.kolom_output, h.baris, map, catatanAturan(h), {
    bukaSamaran,
  });
}

export function tabelDariDpjp(
  baris: BarisHasil[],
  map: ColumnMap,
  bukaSamaran: boolean,
): TabelEkspor {
  return siapkanTabel(
    'ringkasan-dpjp',
    KOLOM_RINGKASAN_DPJP,
    baris,
    map,
    [CATATAN_RINGKASAN_DPJP],
    { bukaSamaran },
  );
}

export function eksporCsv(tabel: TabelEkspor): void {
  const nama = namaBerkasAman(
    `${tabel.nama}-${capWaktu()}${tabel.tersamarkan ? '' : '-TIDAK-TERSAMAR'}.csv`,
  );
  unduhBytes(nama, csvKeBytes(tabelKeCsv(tabel)), MIME_CSV);
}

export function eksporXlsx(tabel: TabelEkspor[], namaDasar: string): void {
  const adaTerbuka = tabel.some((t) => !t.tersamarkan);
  const nama = namaBerkasAman(
    `${namaDasar}-${capWaktu()}${adaTerbuka ? '-TIDAK-TERSAMAR' : ''}.xlsx`,
  );
  unduhBytes(nama, tabelKeXlsx(tabel), TIPE_MIME_XLSX);
}
