/**
 * Pemuatan dan validasi config/column-map.yaml.
 *
 * Nama kolom berkas E-Klaim TIDAK BOLEH ditulis di kode program; semuanya
 * berasal dari berkas YAML ini.
 */
import yaml from 'js-yaml';
import { z } from 'zod';

const tipeKolom = z.enum([
  'teks',
  'kode',
  'enum',
  'bilangan',
  'desimal',
  'tanggal',
  'daftar_kode',
  'majemuk',
  'mentah',
]);

export type TipeKolom = z.infer<typeof tipeKolom>;

const subField = z.object({
  nama: z.string().min(1),
  tipe: tipeKolom,
});

const kolom = z
  .object({
    sumber: z.string().min(1),
    nama: z.string().regex(/^[a-z][a-z0-9_]*$/, 'nama kolom baku harus snake_case'),
    tipe: tipeKolom,
    enum: z.array(z.string()).optional(),
    identitas: z.boolean().optional().default(false),
    komponen_tarif: z.boolean().optional().default(false),
    sub_field: z.array(subField).optional(),
    /** Menandai kolom yang punya pengolah khusus di luar normalisasi biasa. */
    pengolahan_khusus: z.enum(['c2']).optional(),
    catatan: z.string().optional(),
  })
  .refine((k) => k.tipe !== 'enum' || (k.enum !== undefined && k.enum.length > 0), {
    message: 'kolom bertipe enum wajib mencantumkan daftar enum',
  })
  .refine((k) => k.tipe !== 'majemuk' || (k.sub_field !== undefined && k.sub_field.length > 0), {
    message: 'kolom bertipe majemuk wajib mencantumkan sub_field',
  });

const kolomTurunan = z.object({
  nama: z.string().regex(/^[a-z][a-z0-9_]*$/),
  tipe: tipeKolom,
  enum: z.array(z.string()).optional(),
  asal: z.string().min(1),
  catatan: z.string().optional(),
});

export const skemaColumnMap = z
  .object({
    versi: z.number().int().positive(),
    pemisah_kolom: z.string().min(1),
    pemisah_daftar: z.string().min(1),
    format_tanggal: z.string().min(1),
    nilai_kosong: z.array(z.string()),
    kolom: z.array(kolom).min(1),
    kolom_turunan: z.array(kolomTurunan).default([]),
  })
  .superRefine((map, ctx) => {
    const lihat = new Set<string>();
    for (const k of map.kolom) {
      const nama = [k.nama, ...(k.sub_field?.map((s) => s.nama) ?? [])];
      for (const n of nama) {
        if (lihat.has(n)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `nama kolom baku ganda: ${n}` });
        }
        lihat.add(n);
      }
    }
    for (const t of map.kolom_turunan) {
      if (lihat.has(t.nama)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `kolom turunan bentrok dengan kolom berkas: ${t.nama}`,
        });
      }
      lihat.add(t.nama);
    }
  });

export type ColumnMap = z.infer<typeof skemaColumnMap>;
export type DefinisiKolom = ColumnMap['kolom'][number];

/**
 * Baca column-map dari teks YAML. Melempar galat dengan pesan yang bisa dibaca
 * manusia bila berkas tidak valid.
 */
export function muatColumnMap(teksYaml: string): ColumnMap {
  let mentah: unknown;
  try {
    mentah = yaml.load(teksYaml);
  } catch (e) {
    throw new Error(`config/column-map.yaml bukan YAML yang sah: ${(e as Error).message}`);
  }

  const hasil = skemaColumnMap.safeParse(mentah);
  if (!hasil.success) {
    const rincian = hasil.error.issues
      .map((i) => `  - ${i.path.join('.') || '(akar)'}: ${i.message}`)
      .join('\n');
    throw new Error(`config/column-map.yaml tidak valid:\n${rincian}`);
  }
  return hasil.data;
}

/** Nama kolom baku yang wajib di-mask di UI dan tidak diekspor tanpa izin. */
export function kolomIdentitas(map: ColumnMap): string[] {
  return map.kolom.flatMap((k) =>
    k.identitas ? [k.nama, ...(k.sub_field?.map((s) => s.nama) ?? [])] : [],
  );
}

/** 18 kolom komponen penyusun TARIF_RS, dalam nama baku. */
export function kolomKomponenTarif(map: ColumnMap): string[] {
  return map.kolom.filter((k) => k.komponen_tarif).map((k) => k.nama);
}
