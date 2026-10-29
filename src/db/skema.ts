/**
 * Pembuatan skema tabel `klaim` dari config/column-map.yaml.
 *
 * Tidak ada DDL yang ditulis tangan: kolom dan tipenya diturunkan dari
 * pemetaan, sehingga menambah kolom di YAML cukup untuk mengubah tabel.
 */
import type { ColumnMap, TipeKolom } from '../parser/columnMap';
import type { NilaiKlaim } from '../parser/types';

/** Kolom bawaan yang selalu ada, di luar kolom berkas. */
export const KOLOM_BAWAAN: Array<{ nama: string; tipe: string }> = [
  { nama: 'nomor_baris', tipe: 'BIGINT' },
  { nama: 'berkas', tipe: 'VARCHAR' },
];

function tipeSql(tipe: TipeKolom): string {
  switch (tipe) {
    case 'bilangan':
      return 'BIGINT';
    case 'desimal':
      return 'DOUBLE';
    case 'tanggal':
      return 'DATE';
    case 'daftar_kode':
      return 'VARCHAR[]';
    default:
      return 'VARCHAR';
  }
}

export interface KolomTabel {
  nama: string;
  tipe: string;
}

/** Daftar kolom tabel `klaim` beserta tipe SQL-nya, dalam urutan tetap. */
export function kolomTabelKlaim(map: ColumnMap): KolomTabel[] {
  const kolom: KolomTabel[] = [...KOLOM_BAWAAN];

  for (const k of map.kolom) {
    if (k.tipe === 'majemuk') {
      for (const sf of k.sub_field ?? []) {
        kolom.push({ nama: sf.nama, tipe: tipeSql(sf.tipe) });
      }
      continue;
    }
    kolom.push({ nama: k.nama, tipe: tipeSql(k.tipe) });
  }

  for (const t of map.kolom_turunan) {
    kolom.push({ nama: t.nama, tipe: tipeSql(t.tipe) });
  }

  return kolom;
}

export function ddlTabelKlaim(map: ColumnMap): string {
  const kolom = kolomTabelKlaim(map)
    .map((k) => `  "${k.nama}" ${k.tipe}`)
    .join(',\n');
  return `CREATE OR REPLACE TABLE klaim (\n${kolom}\n)`;
}

export const DDL_HARI_LIBUR = `CREATE OR REPLACE TABLE hari_libur (
  "tanggal" DATE,
  "keterangan" VARCHAR,
  "jenis" VARCHAR
)`;

/** Ubah nilai JavaScript menjadi literal SQL yang aman. */
export function literalSql(nilai: NilaiKlaim | undefined): string {
  if (nilai === null || nilai === undefined) return 'NULL';
  if (typeof nilai === 'number') {
    return Number.isFinite(nilai) ? String(nilai) : 'NULL';
  }
  if (Array.isArray(nilai)) {
    if (nilai.length === 0) return "CAST([] AS VARCHAR[])";
    return `[${nilai.map((v) => teksSql(v)).join(', ')}]`;
  }
  return teksSql(nilai);
}

function teksSql(v: string): string {
  // Kutip tunggal digandakan; itu satu-satunya pelolosan yang dibutuhkan DuckDB.
  return `'${v.replace(/'/g, "''")}'`;
}
