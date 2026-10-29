/**
 * Alur audit lengkap: berkas masuk -> parser -> DuckDB -> aturan -> ringkasan.
 *
 * Fungsi di berkas ini tidak menyentuh DOM dan tidak membuat koneksi sendiri,
 * sehingga alur yang sama bisa diuji di Node dengan koneksi uji.
 */
import type { KoneksiKlaim } from '../db/types';
import { muatHariLibur, muatKlaim } from '../db/muat';
import type { AturanDitolak } from '../rules/muat';
import type { HasilAturan, NilaiParameter } from '../rules/engine';
import { jalankanSemuaAturan } from '../rules/engine';
import { ringkasanPerBerkas, ringkasanPerDpjp } from '../rules/ringkasan';
import type { BarisHasil } from '../db/types';
import { parseEklaim } from '../parser/parseEklaim';
import { validasiSemua } from '../parser/validate';
import type { Klaim, Peringatan, RingkasanParsing } from '../parser/types';
import { aturan as aturanBawaan, berkasHariLibur, columnMap } from './aset';
import { bongkarBerkas } from './zip';
import type { BerkasMasuk } from './zip';

export interface HasilAudit {
  /** Ringkasan parsing per berkas. */
  ringkasanBerkasParsing: RingkasanParsing[];
  /** Peringatan dari pembongkaran ZIP dan parser. */
  peringatanParser: Peringatan[];
  /** Pelanggaran relasi struktural antar-kolom. */
  peringatanRelasi: Peringatan[];
  /** Aturan yang ditolak karena tidak memenuhi skema. */
  aturanDitolak: AturanDitolak[];
  temuan: HasilAturan[];
  ringkasanDpjp: BarisHasil[];
  ringkasanBerkas: BarisHasil[];
  jumlahKlaim: number;
  /** Klaim hasil parsing, untuk tampilan detail per baris. */
  klaim: Klaim[];
  /** True bila daftar hari libur belum diverifikasi dari SKB. */
  hariLiburMasihPlaceholder: boolean;
  /** Lama pemrosesan dalam milidetik, untuk ditampilkan apa adanya. */
  durasiMs: number;
}

export interface OpsiAudit {
  parameter?: NilaiParameter;
  /** Dipanggil di tiap tahap agar UI bisa menampilkan kemajuan. */
  lapor?: (tahap: string) => void;
}

export async function jalankanAudit(
  masuk: BerkasMasuk[],
  koneksi: KoneksiKlaim,
  opsi: OpsiAudit = {},
): Promise<HasilAudit> {
  const mulai = Date.now();
  const lapor = opsi.lapor ?? ((): void => {});
  const map = columnMap();

  lapor('Membongkar berkas');
  const bongkar = bongkarBerkas(masuk);
  const peringatanParser: Peringatan[] = [...bongkar.peringatan];

  lapor('Membaca berkas');
  const ringkasanBerkasParsing: RingkasanParsing[] = [];
  const klaim: Klaim[] = [];
  for (const b of bongkar.berkas) {
    const hasil = parseEklaim(b.bytes, map, { namaBerkas: b.nama });
    ringkasanBerkasParsing.push(hasil.ringkasan);
    peringatanParser.push(...hasil.peringatan);
    klaim.push(...hasil.klaim);
  }

  lapor('Memeriksa relasi antar-kolom');
  const peringatanRelasi = validasiSemua(klaim, map);

  lapor('Menyiapkan tabel');
  await muatKlaim(koneksi, klaim, map);
  await muatHariLibur(koneksi, berkasHariLibur());

  lapor('Menjalankan aturan');
  const daftar = aturanBawaan();
  const temuan = klaim.length > 0 ? await jalankanSemuaAturan(koneksi, daftar.aturan, opsi) : [];

  lapor('Menyusun ringkasan');
  const ringkasanDpjp = klaim.length > 0 ? await ringkasanPerDpjp(koneksi) : [];
  const ringkasanBerkas = klaim.length > 0 ? await ringkasanPerBerkas(koneksi) : [];

  return {
    ringkasanBerkasParsing,
    peringatanParser,
    peringatanRelasi,
    aturanDitolak: daftar.ditolak,
    temuan,
    ringkasanDpjp,
    ringkasanBerkas,
    jumlahKlaim: klaim.length,
    klaim,
    hariLiburMasihPlaceholder: berkasHariLibur().every((b) => b.status !== 'terverifikasi'),
    durasiMs: Date.now() - mulai,
  };
}

/** Hitung peringatan menurut tingkatnya, untuk ditampilkan di ringkasan. */
export function hitungTingkat(peringatan: Peringatan[]): {
  galat: number;
  peringatan: number;
  info: number;
} {
  return {
    galat: peringatan.filter((p) => p.tingkat === 'galat').length,
    peringatan: peringatan.filter((p) => p.tingkat === 'peringatan').length,
    info: peringatan.filter((p) => p.tingkat === 'info').length,
  };
}

/** Kelompokkan peringatan per kode, dengan contoh baris pertama. */
export interface PeringatanTerkelompok {
  kode: string;
  tingkat: Peringatan['tingkat'];
  jumlah: number;
  pesanContoh: string;
  barisContoh: number[];
}

export function kelompokkanPeringatan(peringatan: Peringatan[]): PeringatanTerkelompok[] {
  const peta = new Map<string, PeringatanTerkelompok>();
  for (const p of peringatan) {
    const ada = peta.get(p.kode);
    if (ada) {
      ada.jumlah += 1;
      if (p.baris !== null && ada.barisContoh.length < 10) ada.barisContoh.push(p.baris);
      continue;
    }
    peta.set(p.kode, {
      kode: p.kode,
      tingkat: p.tingkat,
      jumlah: 1,
      pesanContoh: p.pesan,
      barisContoh: p.baris === null ? [] : [p.baris],
    });
  }
  const urutan: Record<Peringatan['tingkat'], number> = { galat: 0, peringatan: 1, info: 2 };
  return [...peta.values()].sort(
    (a, b) => urutan[a.tingkat] - urutan[b.tingkat] || b.jumlah - a.jumlah,
  );
}
