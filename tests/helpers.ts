import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { muatColumnMap } from '../src/parser/columnMap';
import type { ColumnMap } from '../src/parser/columnMap';
import type { Peringatan } from '../src/parser/types';

let cache: ColumnMap | null = null;

/** Baca config/column-map.yaml yang sesungguhnya dipakai aplikasi. */
export function mapUji(): ColumnMap {
  if (cache) return cache;
  const jalur = fileURLToPath(new URL('../config/column-map.yaml', import.meta.url));
  cache = muatColumnMap(readFileSync(jalur, 'utf8'));
  return cache;
}

export function kode(peringatan: Peringatan[]): string[] {
  return peringatan.map((p) => p.kode);
}

export function padaBaris(peringatan: Peringatan[], baris: number): Peringatan[] {
  return peringatan.filter((p) => p.baris === baris);
}
