/**
 * Pemuatan berkas aturan YAML.
 *
 * Pemanggil yang menyediakan isi berkas, bukan modul ini, supaya modul ini
 * bebas dari akses berkas: di browser isi berkas datang dari import.meta.glob,
 * di test dari pembacaan folder rules/.
 */
import yaml from 'js-yaml';

import { skemaAturan } from './schema';
import type { Aturan } from './schema';

export interface BerkasAturan {
  /** Jalur berkas, dipakai di pesan galat. */
  jalur: string;
  teks: string;
}

export interface AturanDitolak {
  jalur: string;
  pesan: string;
}

export interface HasilPemuatanAturan {
  aturan: Aturan[];
  ditolak: AturanDitolak[];
}

/**
 * Baca dan validasi seluruh berkas aturan. Aturan yang tidak valid tidak
 * menggagalkan pemuatan aturan lain; semuanya dikumpulkan di `ditolak`.
 */
export function muatAturan(berkas: BerkasAturan[]): HasilPemuatanAturan {
  const diterima: Array<{ aturan: Aturan; jalur: string }> = [];
  const ditolak: AturanDitolak[] = [];

  for (const b of berkas) {
    let mentah: unknown;
    try {
      mentah = yaml.load(b.teks);
    } catch (e) {
      ditolak.push({ jalur: b.jalur, pesan: `bukan YAML yang sah: ${(e as Error).message}` });
      continue;
    }

    const hasil = skemaAturan.safeParse(mentah);
    if (!hasil.success) {
      const rincian = hasil.error.issues
        .map((i) => `${i.path.join('.') || '(akar)'}: ${i.message}`)
        .join('; ');
      ditolak.push({ jalur: b.jalur, pesan: rincian });
      continue;
    }
    diterima.push({ aturan: hasil.data, jalur: b.jalur });
  }

  // id ganda akan membuat temuan tertukar di UI, jadi ditolak.
  const terlihat = new Map<string, string>();
  const bersih: Aturan[] = [];
  for (const { aturan: a, jalur } of diterima) {
    const sebelumnya = terlihat.get(a.id);
    if (sebelumnya !== undefined) {
      ditolak.push({ jalur, pesan: `id "${a.id}" sudah dipakai oleh ${sebelumnya}` });
      continue;
    }
    terlihat.set(a.id, jalur);
    bersih.push(a);
  }

  return { aturan: bersih, ditolak };
}
