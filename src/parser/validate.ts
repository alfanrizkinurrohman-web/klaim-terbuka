/**
 * Validasi relasi antar-kolom.
 *
 * Relasi di berkas ini adalah relasi STRUKTURAL berkas E-Klaim — bukan aturan
 * audit klaim. Relasi yang tidak terpenuhi berarti berkas atau hasil grouping
 * patut dipertanyakan, dan koder perlu diberi tahu sebelum temuan audit
 * ditampilkan.
 *
 * Seluruh relasi di sini terverifikasi 0 pelanggaran pada sampel Fase 0; lihat
 * docs/format-eklaim.md bagian 4.
 */
import type { ColumnMap } from './columnMap';
import { kolomKomponenTarif } from './columnMap';
import { selisihHari } from './normalize';
import type { Klaim, NilaiKlaim, Peringatan } from './types';

/**
 * Toleransi relasi IDRG.
 *
 * IDRG_TOTAL_COST_WEIGHT disimpan 2 angka desimal, sedangkan IDRG_TOTAL_TARIF
 * dihitung dari cost weight yang belum dibulatkan. Toleransi yang benar adalah
 * setengah satuan desimal terakhir dikali NBR, bukan Rp1.
 * Lihat docs/format-eklaim.md bagian 4.1.
 */
export const TOLERANSI_IDRG_FAKTOR = 0.005;

/** Tujuh kolom penyusun total_tarif. */
const KOLOM_TOTAL_TARIF = [
  'tarif_inacbg',
  'tarif_subacute',
  'tarif_chronic',
  'tarif_sp',
  'tarif_sr',
  'tarif_si',
  'tarif_sd',
] as const;

const POLA_INACBG = /^[A-Z]-\d-\d\d-(0|I{1,3})$/;

const PTD_RAWAT_INAP = '1';
const PTD_RAWAT_JALAN = '2';

function angka(v: NilaiKlaim | undefined): number | null {
  return typeof v === 'number' ? v : null;
}

function teks(v: NilaiKlaim | undefined): string | null {
  return typeof v === 'string' ? v : null;
}

function rupiah(n: number): string {
  return `Rp${n.toLocaleString('id-ID')}`;
}

/**
 * Periksa seluruh relasi pada satu klaim.
 */
export function validasiKlaim(klaim: Klaim, komponenTarif: string[]): Peringatan[] {
  const hasil: Peringatan[] = [];
  const baris = klaim.nomor_baris;

  const masuk = teks(klaim['tanggal_masuk']);
  const pulang = teks(klaim['tanggal_pulang']);
  const los = angka(klaim['los']);
  const ptd = teks(klaim['ptd']);

  // --- Tanggal ---
  if (masuk && pulang && selisihHari(masuk, pulang) < 0) {
    hasil.push({
      kode: 'TANGGAL_PULANG_MENDAHULUI_MASUK',
      tingkat: 'galat',
      baris,
      pesan: 'Tanggal pulang lebih awal daripada tanggal masuk.',
    });
  }

  // --- LOS = (pulang - masuk) + 1 ---
  if (masuk && pulang && los !== null) {
    const diharapkan = selisihHari(masuk, pulang) + 1;
    if (diharapkan !== los) {
      hasil.push({
        kode: 'RELASI_LOS',
        tingkat: 'galat',
        baris,
        pesan:
          `LOS tertulis ${los} hari, sedangkan dari tanggal masuk dan pulang ` +
          `seharusnya ${diharapkan} hari.`,
      });
    }
  }

  // --- TARIF_RS = jumlah 18 komponen ---
  const adaKomponen = komponenTarif.some((k) => angka(klaim[k]) !== null);
  const tarifRs = angka(klaim['tarif_rs']);
  if (adaKomponen && tarifRs !== null) {
    const jumlah = komponenTarif.reduce((t, k) => t + (angka(klaim[k]) ?? 0), 0);
    if (jumlah !== tarifRs) {
      hasil.push({
        kode: 'RELASI_TARIF_RS',
        tingkat: 'galat',
        baris,
        pesan:
          `Tarif RS tertulis ${rupiah(tarifRs)}, sedangkan jumlah ${komponenTarif.length} ` +
          `komponen biaya ${rupiah(jumlah)} (selisih ${rupiah(tarifRs - jumlah)}).`,
      });
    }
  }

  // --- TOTAL_TARIF = jumlah 7 tarif ---
  const totalTarif = angka(klaim['total_tarif']);
  const adaTarif = KOLOM_TOTAL_TARIF.some((k) => angka(klaim[k]) !== null);
  if (adaTarif && totalTarif !== null) {
    const jumlah = KOLOM_TOTAL_TARIF.reduce((t, k) => t + (angka(klaim[k]) ?? 0), 0);
    if (jumlah !== totalTarif) {
      hasil.push({
        kode: 'RELASI_TOTAL_TARIF',
        tingkat: 'galat',
        baris,
        pesan:
          `Total tarif tertulis ${rupiah(totalTarif)}, sedangkan jumlah tarif ` +
          `INA-CBG dan special CMG ${rupiah(jumlah)} (selisih ${rupiah(totalTarif - jumlah)}).`,
      });
    }
  }

  // --- IDRG_TOTAL_TARIF ~= IDRG_TOTAL_COST_WEIGHT x IDRG_NBR ---
  const cw = angka(klaim['idrg_total_cost_weight']);
  const nbr = angka(klaim['idrg_nbr']);
  const idrgTarif = angka(klaim['idrg_total_tarif']);
  if (cw !== null && nbr !== null && idrgTarif !== null && nbr > 0) {
    // Dua pembulatan menumpuk: cost weight dipotong ke 2 desimal (0,005 x NBR),
    // lalu tarif iDRG dibulatkan ke rupiah penuh (0,5 rupiah lagi).
    const toleransi = TOLERANSI_IDRG_FAKTOR * nbr + 0.5;
    const selisih = Math.abs(idrgTarif - cw * nbr);
    if (selisih > toleransi) {
      hasil.push({
        kode: 'RELASI_IDRG',
        tingkat: 'peringatan',
        baris,
        pesan:
          `Tarif iDRG ${rupiah(idrgTarif)} tidak sesuai cost weight ${cw} x NBR ` +
          `${rupiah(nbr)} = ${rupiah(Math.round(cw * nbr))} ` +
          `(selisih ${rupiah(Math.round(selisih))}, batas wajar ${rupiah(Math.round(toleransi))}).`,
      });
    }
  }

  // --- Format kode INA-CBG ---
  const inacbg = teks(klaim['kode_inacbg']);
  if (inacbg !== null && !POLA_INACBG.test(inacbg)) {
    hasil.push({
      kode: 'FORMAT_KODE_INACBG',
      tingkat: 'peringatan',
      baris,
      pesan:
        `Kode INA-CBG "${inacbg}" tidak mengikuti pola CMG-tipe-spesifik-severity ` +
        '(contoh M-3-16-0).',
    });
  }

  // --- Rawat jalan: satu hari, tanggal masuk = tanggal pulang ---
  if (ptd === PTD_RAWAT_JALAN) {
    if (los !== null && los !== 1) {
      hasil.push({
        kode: 'RAJAL_LOS_BUKAN_1',
        tingkat: 'peringatan',
        baris,
        pesan: `Klaim rawat jalan tetapi LOS ${los} hari.`,
      });
    }
    if (masuk && pulang && masuk !== pulang) {
      hasil.push({
        kode: 'RAJAL_TANGGAL_BERBEDA',
        tingkat: 'peringatan',
        baris,
        pesan: 'Klaim rawat jalan tetapi tanggal masuk dan tanggal pulang berbeda.',
      });
    }
  }

  // --- Umur dalam hari terhadap tanggal lahir ---
  const lahir = teks(klaim['tanggal_lahir']);
  const umurHari = angka(klaim['umur_hari']);
  if (lahir && masuk && umurHari !== null) {
    const diharapkan = selisihHari(lahir, masuk);
    if (Math.abs(diharapkan - umurHari) > 1) {
      hasil.push({
        kode: 'RELASI_UMUR_HARI',
        tingkat: 'peringatan',
        baris,
        pesan:
          `Umur tertulis ${umurHari} hari, sedangkan dari tanggal lahir dan tanggal ` +
          `masuk seharusnya ${diharapkan} hari.`,
      });
    }
  }

  // --- PTD di luar nilai yang dikenali ---
  if (ptd !== null && ptd !== PTD_RAWAT_INAP && ptd !== PTD_RAWAT_JALAN) {
    hasil.push({
      kode: 'PTD_TIDAK_DIKENALI',
      tingkat: 'galat',
      baris,
      pesan:
        `Jenis rawat (PTD) bernilai "${ptd}"; hanya 1 (rawat inap) dan ` +
        '2 (rawat jalan) yang dikenali.',
    });
  }

  return hasil;
}

/** Jalankan validasi relasi pada seluruh klaim hasil parsing. */
export function validasiSemua(klaim: Klaim[], map: ColumnMap): Peringatan[] {
  const komponen = kolomKomponenTarif(map);
  return klaim.flatMap((k) => validasiKlaim(k, komponen));
}
