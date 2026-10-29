/**
 * Aset konfigurasi yang dibundel ke dalam aplikasi.
 *
 * Semuanya di-import sebagai modul sehingga ikut dibundel saat build — tidak
 * ada yang diambil lewat jaringan saat aplikasi berjalan. Jalur yang sama
 * dipakai di test, karena Vitest memakai Vite, jadi test memverifikasi berkas
 * aturan yang sesungguhnya.
 */
import teksColumnMap from '../../config/column-map.yaml?raw';
import hariLibur2026 from '../../data/hari-libur/2026.json';
import type { BerkasHariLibur } from '../db/muat';
import { muatColumnMap } from '../parser/columnMap';
import type { ColumnMap } from '../parser/columnMap';
import { muatAturan } from '../rules/muat';
import type { BerkasAturan, HasilPemuatanAturan } from '../rules/muat';

const berkasAturanMentah = import.meta.glob('../../rules/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

let cacheColumnMap: ColumnMap | null = null;

export function columnMap(): ColumnMap {
  cacheColumnMap ??= muatColumnMap(teksColumnMap);
  return cacheColumnMap;
}

export function berkasAturan(): BerkasAturan[] {
  return Object.entries(berkasAturanMentah)
    .filter(([jalur]) => !/\/_[^/]*$/.test(jalur)) // _template.yaml dan sejenisnya dilewati
    .map(([jalur, teks]) => ({
      jalur: jalur.replace(/^\.\.\/\.\.\//, ''),
      teks,
    }))
    .sort((a, b) => a.jalur.localeCompare(b.jalur));
}

let cacheAturan: HasilPemuatanAturan | null = null;

export function aturan(): HasilPemuatanAturan {
  cacheAturan ??= muatAturan(berkasAturan());
  return cacheAturan;
}

export function berkasHariLibur(): BerkasHariLibur[] {
  return [hariLibur2026 as unknown as BerkasHariLibur];
}

/** True bila belum ada satu pun tahun yang daftar hari liburnya terverifikasi. */
export function hariLiburMasihPlaceholder(): boolean {
  return berkasHariLibur().every((b) => b.status !== 'terverifikasi');
}
