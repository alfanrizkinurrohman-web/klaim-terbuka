/**
 * Skema berkas aturan YAML.
 *
 * Satu aturan = satu berkas di rules/<kategori>/<id>.yaml. Aturan yang tidak
 * memenuhi skema ini DITOLAK dengan pesan yang menyebut berkas dan field-nya,
 * supaya koder yang menyumbang aturan tahu persis apa yang harus diperbaiki.
 *
 * Dua penjagaan penting ada di sini:
 *   1. query wajib hanya membaca (SELECT/WITH, tanpa kata kunci pengubah data);
 *   2. aturan berstatus `tervalidasi` wajib menyebut sumber regulasinya.
 */
import { z } from 'zod';

/**
 * Kata kunci SQL yang mengubah data atau keadaan basis data. Query aturan
 * hanya boleh membaca.
 */
const KATA_KUNCI_TERLARANG = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'CREATE',
  'ALTER',
  'TRUNCATE',
  'REPLACE',
  'ATTACH',
  'DETACH',
  'COPY',
  'EXPORT',
  'IMPORT',
  'INSTALL',
  'LOAD',
  'PRAGMA',
  'CALL',
  'SET',
  'RESET',
];

/** Hapus komentar SQL agar penjagaan tidak bisa diakali lewat komentar. */
function tanpaKomentar(sql: string): string {
  return sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

const kolomOutput = z.object({
  nama: z.string().min(1),
  label: z.string().min(1),
  /** Tandai true bila kolom ini memuat identitas dan wajib di-mask di UI. */
  identitas: z.boolean().optional().default(false),
  /** Petunjuk tampilan: rupiah, tanggal, daftar, angka, teks. */
  format: z.enum(['teks', 'angka', 'rupiah', 'tanggal', 'daftar']).optional().default('teks'),
});

const parameter = z.object({
  nama: z.string().regex(/^[a-z][a-z0-9_]*$/, 'nama parameter harus snake_case'),
  deskripsi: z.string().min(1),
  tipe: z.enum(['bilangan', 'teks']),
  bawaan: z.union([z.number(), z.string()]),
});

export const skemaAturan = z
  .object({
    id: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/, 'id harus huruf kecil dengan tanda hubung, mis. duplikasi-klaim'),
    judul: z.string().min(1),
    kategori: z.string().regex(/^[a-z][a-z0-9-]*$/),
    status: z.enum(['draft', 'tervalidasi']),
    /**
     * tingkat menentukan cara UI menampilkan hasil:
     *   temuan    = perlu diperiksa koder
     *   informasi = bukan kesalahan, hanya perlu diketahui
     */
    tingkat: z.enum(['temuan', 'informasi']).default('temuan'),
    deskripsi: z.string().min(1),
    /** Null hanya boleh untuk aturan berstatus draft. */
    sumber_regulasi: z.string().min(1).nullable(),
    query: z.string().min(1),
    kolom_output: z.array(kolomOutput).min(1),
    bukti_yang_perlu_diperiksa: z.array(z.string().min(1)).min(1),
    catatan_etika: z.string().min(1),
    parameter: z.array(parameter).default([]),
    /** True bila aturan bergantung pada tabel hari_libur. */
    butuh_hari_libur: z.boolean().default(false),
    catatan: z.string().optional(),
  })
  .superRefine((a, ctx) => {
    const sql = tanpaKomentar(a.query);

    if (!/^\s*(select|with)\b/i.test(sql)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['query'],
        message: 'query harus dimulai dengan SELECT atau WITH; aturan hanya boleh membaca data',
      });
    }

    for (const kata of KATA_KUNCI_TERLARANG) {
      if (new RegExp(`\\b${kata}\\b`, 'i').test(sql)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['query'],
          message: `query memuat kata kunci "${kata}" yang dapat mengubah data; aturan hanya boleh membaca`,
        });
      }
    }

    if (/;\s*\S/.test(sql)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['query'],
        message: 'query hanya boleh berisi satu pernyataan',
      });
    }

    if (a.status === 'tervalidasi' && !a.sumber_regulasi) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sumber_regulasi'],
        message:
          'aturan berstatus tervalidasi wajib mencantumkan sumber_regulasi. ' +
          'Bila sumbernya belum pasti, pakai status: draft.',
      });
    }

    // Parameter yang dipakai di query wajib dideklarasikan, dan sebaliknya.
    const dipakai = new Set(
      [...a.query.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g)].map((m) => m[1] as string),
    );
    const dideklarasikan = new Set(a.parameter.map((p) => p.nama));
    for (const n of dipakai) {
      if (!dideklarasikan.has(n)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['query'],
          message: `query memakai parameter {{${n}}} yang tidak dideklarasikan di parameter:`,
        });
      }
    }
    for (const n of dideklarasikan) {
      if (!dipakai.has(n)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['parameter'],
          message: `parameter "${n}" dideklarasikan tetapi tidak dipakai di query`,
        });
      }
    }

    // Setiap kolom_output harus benar-benar muncul di query, supaya label di UI
    // tidak menunjuk kolom yang tidak ada.
    for (const k of a.kolom_output) {
      if (!new RegExp(`\\b${k.nama}\\b`).test(sql)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['kolom_output'],
          message: `kolom_output "${k.nama}" tidak ditemukan di query`,
        });
      }
    }
  });

export type Aturan = z.infer<typeof skemaAturan>;
export type KolomOutput = z.infer<typeof kolomOutput>;
export type ParameterAturan = z.infer<typeof parameter>;

export { KATA_KUNCI_TERLARANG };
