/**
 * Pemuatan berkas aturan sesungguhnya dari folder rules/ untuk keperluan test.
 *
 * Test memakai berkas yang sama dengan yang dipakai aplikasi, bukan salinan,
 * supaya aturan yang rusak langsung terdeteksi.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { muatAturan } from '../../src/rules/muat';
import type { BerkasAturan } from '../../src/rules/muat';
import type { Aturan } from '../../src/rules/schema';

export const AKAR_RULES = fileURLToPath(new URL('../../rules', import.meta.url));

function berkasYaml(dir: string): string[] {
  return readdirSync(dir).flatMap((nama) => {
    const jalur = join(dir, nama);
    if (statSync(jalur).isDirectory()) return berkasYaml(jalur);
    return /\.ya?ml$/.test(nama) && !nama.startsWith('_') ? [jalur] : [];
  });
}

export function berkasAturan(): BerkasAturan[] {
  return berkasYaml(AKAR_RULES).map((jalur) => ({
    jalur: jalur.replace(AKAR_RULES, 'rules').replace(/\\/g, '/'),
    teks: readFileSync(jalur, 'utf8'),
  }));
}

let cache: Aturan[] | null = null;

/** Seluruh aturan yang valid. Melempar galat bila ada aturan yang ditolak. */
export function semuaAturan(): Aturan[] {
  if (cache) return cache;
  const hasil = muatAturan(berkasAturan());
  if (hasil.ditolak.length > 0) {
    const rincian = hasil.ditolak.map((d) => `${d.jalur}: ${d.pesan}`).join('\n');
    throw new Error(`ada aturan yang tidak valid:\n${rincian}`);
  }
  cache = hasil.aturan;
  return cache;
}

export function aturanDenganId(id: string): Aturan {
  const a = semuaAturan().find((x) => x.id === id);
  if (!a) {
    const tersedia = semuaAturan()
      .map((x) => x.id)
      .join(', ');
    throw new Error(`aturan "${id}" tidak ada. Yang tersedia: ${tersedia}`);
  }
  return a;
}
