/**
 * Generator berkas E-Klaim SINTETIS untuk keperluan test.
 *
 * Tidak satu pun nilai di berkas ini berasal dari data klaim nyata. Nama pasien,
 * nomor rekam medis, SEP, dan nomor kartu dibangkitkan dari pola yang jelas
 * palsu ("SINTETIS"), dan seluruh angka berasal dari PRNG dengan benih tetap
 * sehingga test dapat diulang.
 *
 * Struktur berkas dibangun dari config/column-map.yaml, sehingga generator ini
 * ikut gagal bila pemetaan kolom berubah tanpa test disesuaikan.
 */
import type { ColumnMap } from '../../src/parser/columnMap';

/** Cacat yang bisa disisipkan ke berkas sintetis. `baris` 1-based terhadap baris data. */
export type Cacat =
  | { jenis: 'jumlah_field_berbeda'; baris: number }
  | { jenis: 'json_c2_rusak'; baris: number }
  | { jenis: 'c2_subfield_kurang'; baris: number }
  | { jenis: 'tarif_rs_tidak_cocok'; baris: number; selisih: number }
  | { jenis: 'total_tarif_tidak_cocok'; baris: number; selisih: number }
  | { jenis: 'los_tidak_cocok'; baris: number; nilai: number }
  | { jenis: 'idrg_tidak_cocok'; baris: number; selisih: number }
  | { jenis: 'tanggal_tidak_sah'; baris: number }
  | { jenis: 'kode_inacbg_salah'; baris: number }
  | { jenis: 'ptd_tidak_dikenali'; baris: number }
  | { jenis: 'baris_kosong_setelah'; baris: number };

export interface OpsiGenerator {
  jumlah?: number;
  benih?: number;
  cacat?: Cacat[];
  /** Akhir baris; default CRLF seperti ekspor asli. */
  akhirBaris?: '\r\n' | '\n';
  /** Sertakan baris header. Default true. */
  denganHeader?: boolean;
}

/** PRNG kecil dengan benih tetap (mulberry32) agar test deterministik. */
function prng(benih: number): () => number {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NBR: Record<string, number> = { '1': 8037060, '2': 461474 };
const SEVERITY = ['0', 'I', 'II', 'III'];
const CMG = ['M', 'K', 'N', 'O', 'W', 'G', 'E', 'I', 'V'];
const CARA_MASUK = ['gp', 'emd', 'outp'];

function pad(n: number, lebar: number): string {
  return String(n).padStart(lebar, '0');
}

function tanggalDdMmYyyy(d: Date): string {
  return `${pad(d.getUTCDate(), 2)}/${pad(d.getUTCMonth() + 1, 2)}/${d.getUTCFullYear()}`;
}

function tambahHari(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** Satu klaim sintetis dalam bentuk map nama-kolom-sumber -> nilai string. */
function buatBaris(i: number, rnd: () => number): Record<string, string> {
  const ptd = rnd() < 0.6 ? '1' : '2';
  const rawatInap = ptd === '1';

  const awal = new Date(Date.UTC(2026, 4, 1));
  const masuk = tambahHari(awal, Math.floor(rnd() * 90));
  const los = rawatInap ? 1 + Math.floor(rnd() * 14) : 1;
  const pulang = tambahHari(masuk, los - 1);

  const umurTahun = Math.floor(rnd() * 90);
  const lahir = tambahHari(masuk, -(umurTahun * 365 + Math.floor(rnd() * 365)));
  const umurHari = Math.round((masuk.getTime() - lahir.getTime()) / 86_400_000);

  // 18 komponen biaya; sebagian nol seperti pada berkas nyata.
  const komponen: Record<string, number> = {
    PROSEDUR_NON_BEDAH: Math.round(rnd() * 5) * 25000,
    PROSEDUR_BEDAH: rnd() < 0.2 ? Math.round(rnd() * 40) * 50000 : 0,
    KONSULTASI: Math.round(rnd() * 12) * 27500,
    TENAGA_AHLI: rnd() < 0.3 ? 5000 : 0,
    KEPERAWATAN: Math.round(rnd() * 20) * 9500,
    PENUNJANG: 0,
    RADIOLOGI: rnd() < 0.3 ? Math.round(rnd() * 6) * 105000 : 0,
    LABORATORIUM: rnd() < 0.6 ? Math.round(rnd() * 10) * 21000 : 0,
    PELAYANAN_DARAH: rnd() < 0.05 ? Math.round(rnd() * 3) * 360000 : 0,
    REHABILITASI: 0,
    KAMAR_AKOMODASI: rawatInap ? los * (rnd() < 0.5 ? 185000 : 485000) : 0,
    RAWAT_INTENSIF: 0,
    OBAT: Math.round(rnd() * 500000),
    ALKES: 0,
    BMHP: Math.round(rnd() * 30) * 7000,
    SEWA_ALAT: 0,
    OBAT_KRONIS: 0,
    OBAT_KEMO: 0,
  };
  const tarifRs = Object.values(komponen).reduce((a, b) => a + b, 0);

  const tarifInacbg = Math.round((tarifRs * (0.8 + rnd() * 0.9)) / 100) * 100;
  const adaSp = rnd() < 0.03;
  const tarifSp = adaSp ? Math.round(rnd() * 20) * 100000 : 0;
  const totalTarif = tarifInacbg + tarifSp;

  // iDRG: cost weight sebenarnya punya lebih dari 2 desimal, tetapi hanya 2
  // yang ditulis ke berkas. Tarif dihitung dari nilai yang belum dibulatkan.
  const nbr = NBR[ptd] ?? 0;
  const cwAsli = Math.round((0.3 + rnd() * 2.5) * 10000) / 10000;
  const cwTertulis = (Math.round(cwAsli * 100) / 100).toFixed(2);
  const idrgTotalTarif = Math.round(cwAsli * nbr);
  const cwDasar = (Math.max(0.1, cwAsli - (rnd() < 0.2 ? 0.05 : 0))).toFixed(2);

  const icu = rawatInap && rnd() < 0.08 ? '1' : '0';
  const icuLos = icu === '1' ? 1 + Math.floor(rnd() * 5) : 0;
  const ventJam = icu === '1' && rnd() < 0.4 ? Math.floor(rnd() * 120) : 0;

  const diag = [`A${pad(Math.floor(rnd() * 99), 2)}.${Math.floor(rnd() * 9)}`];
  if (rnd() < 0.5) diag.push(`B${pad(Math.floor(rnd() * 99), 2)}.${Math.floor(rnd() * 9)}`);
  const adaProsedur = rnd() < 0.7;
  const proc = adaProsedur
    ? [`${pad(Math.floor(rnd() * 99), 2)}.${pad(Math.floor(rnd() * 99), 2)}`]
    : [];

  const inacbg = `${CMG[Math.floor(rnd() * CMG.length)]}-${rawatInap ? 4 : 3}-${pad(
    1 + Math.floor(rnd() * 40),
    2,
  )}-${rawatInap ? SEVERITY[1 + Math.floor(rnd() * 3)] : '0'}`;

  const naikKelas = rawatInap && rnd() < 0.1 ? '1' : '0';
  const kelasTujuan = naikKelas === '1' ? (rnd() < 0.5 ? 'kelas_1' : 'vip') : '';
  const selisihNilai = naikKelas === '1' ? String(Math.round(rnd() * 50) * 10000) : '0';

  const jsonKlinis = {
    cara_masuk: CARA_MASUK[Math.floor(rnd() * CARA_MASUK.length)],
    sistole: String(Math.round(90 + rnd() * 70)),
    diastole: String(Math.round(60 + rnd() * 40)),
    total_tarif_rs: String(tarifRs),
    billing_group: {
      procedure_amt: String(komponen['PROSEDUR_NON_BEDAH']),
      surgical_amt: String(komponen['PROSEDUR_BEDAH']),
      consul_amt: String(komponen['KONSULTASI']),
      expert_amt: String(komponen['TENAGA_AHLI']),
      nursing_amt: String(komponen['KEPERAWATAN']),
      ancillary_amt: String(komponen['PENUNJANG']),
      blood_amt: String(komponen['PELAYANAN_DARAH']),
      laboratory_amt: String(komponen['LABORATORIUM']),
      radiology_amt: String(komponen['RADIOLOGI']),
      rehab_amt: String(komponen['REHABILITASI']),
      room_amt: String(komponen['KAMAR_AKOMODASI']),
      intensive_amt: String(komponen['RAWAT_INTENSIF']),
      drug_amt: String(komponen['OBAT']),
      device_amt: String(komponen['ALKES']),
      consumable_amt: String(komponen['BMHP']),
      device_rent_amt: String(komponen['SEWA_ALAT']),
      drug_chronic_amt: String(komponen['OBAT_KRONIS']),
      drug_chemo_amt: String(komponen['OBAT_KEMO']),
    },
    selisih_biaya: { nilai: selisihNilai, pembayar: naikKelas === '1' ? 'peserta' : '', naik_kelas: kelasTujuan },
    ventilator: {
      use_ind: ventJam > 0 ? '1' : '',
      start_dttm: '0000-00-00 00:00:00',
      stop_dttm: '0000-00-00 00:00:00',
    },
    dializer_single_use: 'na',
    alteplase_ind: '0',
    kantong_darah: String((komponen['PELAYANAN_DARAH'] ?? 0) > 0 ? 1 + Math.floor(rnd() * 3) : 0),
    apgar_score: null as string | null,
    persalinan: null as Record<string, unknown> | null,
    episode_ruangan: [] as unknown[],
    obat: [] as unknown[],
    dpjp: { code: '', name: '' },
    idrg: {
      diag_lists: diag.join(';'),
      proc_lists: proc.join(';'),
      mdc_number: pad(1 + Math.floor(rnd() * 28), 2),
      mdc_description: 'MDC SINTETIS',
      drg_code: String(1000000 + Math.floor(rnd() * 8999999)),
      drg_description: 'DRG SINTETIS',
      cost_weight: cwDasar,
      total_cost_weight: cwTertulis,
      nbr: String(nbr),
      total_tarif: String(idrgTotalTarif),
      grouper_version: '1.0.33',
      logic_version: '0.2.1831.202606291712',
    },
  };

  if (rnd() < 0.1) {
    jsonKlinis.persalinan = {
      usia_kehamilan: String(36 + Math.floor(rnd() * 5)),
      gravida: String(1 + Math.floor(rnd() * 4)),
      partus: String(Math.floor(rnd() * 3)),
      abortus: '0',
      onset_kontraksi: 'spontan',
      delivery: [{ delivery_method: rnd() < 0.5 ? 'sc' : 'spontan', letak_janin: 'kepala', kondisi: 'hidup' }],
    };
  }

  // C2: 14 sub-field. Sub-field 12 dan 13 sengaja diisi data identitas PALSU
  // agar test dapat membuktikan parser membuangnya.
  const subField = [
    '1',
    naikKelas,
    kelasTujuan,
    '0',
    selisihNilai,
    '0.0',
    `2026-09-${pad(1 + (i % 28), 2)} 10:${pad(i % 60, 2)}:00`,
    '0',
    '00:00:00',
    '00:00:00',
    '00:00:00',
    '{"nama":"JANGAN TAMPIL SINTETIS","nik":"0000000000000000"}',
    '{"registri_tb":{"nama":"JANGAN TAMPIL SINTETIS","nik":"1111111111111111"}}',
    JSON.stringify(jsonKlinis),
  ];

  return {
    KODE_RS: '0000000',
    KELAS_RS: 'C',
    KELAS_RAWAT: rawatInap ? String(1 + Math.floor(rnd() * 3)) : '3',
    KODE_TARIF: 'CS',
    PTD: ptd,
    ADMISSION_DATE: tanggalDdMmYyyy(masuk),
    DISCHARGE_DATE: tanggalDdMmYyyy(pulang),
    BIRTH_DATE: tanggalDdMmYyyy(lahir),
    BIRTH_WEIGHT: '0',
    SEX: rnd() < 0.5 ? '1' : '2',
    DISCHARGE_STATUS: rnd() < 0.85 ? '1' : String(2 + Math.floor(rnd() * 4)),
    DIAGLIST: diag.join(';'),
    PROCLIST: adaProsedur ? proc.join(';') : '-',
    ADL1: '-',
    ADL2: '-',
    IN_SP: adaSp ? 'YY10' : 'None',
    IN_SR: 'None',
    IN_SI: 'None',
    IN_SD: 'None',
    INACBG: inacbg,
    SUBACUTE: 'None',
    CHRONIC: 'None',
    SP: adaSp ? 'YY-10-III' : 'None',
    SR: 'None',
    SI: 'None',
    SD: 'None',
    DESKRIPSI_INACBG: 'DESKRIPSI SINTETIS',
    TARIF_INACBG: String(tarifInacbg),
    TARIF_SUBACUTE: '0',
    TARIF_CHRONIC: '0',
    DESKRIPSI_SP: adaSp ? 'PROSEDUR KHUSUS SINTETIS' : '-',
    TARIF_SP: String(tarifSp),
    DESKRIPSI_SR: '-',
    TARIF_SR: '0',
    DESKRIPSI_SI: '-',
    TARIF_SI: '0',
    DESKRIPSI_SD: '-',
    TARIF_SD: '0',
    TOTAL_TARIF: String(totalTarif),
    TARIF_RS: String(tarifRs),
    TARIF_POLI_EKS: '0',
    LOS: String(los),
    ICU_INDIKATOR: icu,
    ICU_LOS: String(icuLos),
    VENT_HOUR: String(ventJam),
    NAMA_PASIEN: `SINTETIS ${pad(i, 4)}`,
    MRN: pad(100000 + (i % 240), 6),
    UMUR_TAHUN: String(umurTahun),
    UMUR_HARI: String(umurHari),
    DPJP: `SNT-${pad(i % 40, 2)}`,
    SEP: `9999S${pad(i, 7)}X999999`,
    NOKARTU: pad(8000000000000 + i, 13),
    PAYOR_ID: '3;JKN',
    CODER_ID: `SNTKD-${pad(i % 7, 2)};${pad(i, 16)};SNTKD-${pad(i % 7, 2)}`,
    VERSI_INACBG: rnd() < 0.8 ? '5.10.8.202606251251' : '5.10.9.202609291001',
    VERSI_GROUPER: '4',
    C1: String(100001 + i),
    C2: subField.join('#'),
    C3: String(1 + Math.floor(rnd() * 6)),
    C4: Array.from({ length: 32 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join(''),
    PROSEDUR_NON_BEDAH: String(komponen['PROSEDUR_NON_BEDAH']),
    PROSEDUR_BEDAH: String(komponen['PROSEDUR_BEDAH']),
    KONSULTASI: String(komponen['KONSULTASI']),
    TENAGA_AHLI: String(komponen['TENAGA_AHLI']),
    KEPERAWATAN: String(komponen['KEPERAWATAN']),
    PENUNJANG: String(komponen['PENUNJANG']),
    RADIOLOGI: String(komponen['RADIOLOGI']),
    LABORATORIUM: String(komponen['LABORATORIUM']),
    PELAYANAN_DARAH: String(komponen['PELAYANAN_DARAH']),
    REHABILITASI: String(komponen['REHABILITASI']),
    KAMAR_AKOMODASI: String(komponen['KAMAR_AKOMODASI']),
    RAWAT_INTENSIF: String(komponen['RAWAT_INTENSIF']),
    OBAT: String(komponen['OBAT']),
    ALKES: String(komponen['ALKES']),
    BMHP: String(komponen['BMHP']),
    SEWA_ALAT: String(komponen['SEWA_ALAT']),
    OBAT_KRONIS: String(komponen['OBAT_KRONIS']),
    OBAT_KEMO: String(komponen['OBAT_KEMO']),
    IDRG_DIAG_LISTS: diag.join(';'),
    IDRG_PROC_LISTS: proc.join(';'),
    IDRG_MDC_NUMBER: jsonKlinis.idrg.mdc_number,
    IDRG_MDC_DESCRIPTION: jsonKlinis.idrg.mdc_description,
    IDRG_DRG_CODE: jsonKlinis.idrg.drg_code,
    IDRG_DRG_DESCRIPTION: jsonKlinis.idrg.drg_description,
    IDRG_COST_WEIGHT: cwDasar,
    IDRG_SA_COST_WEIGHT: '',
    IDRG_CH_COST_WEIGHT: '',
    IDRG_TOP_UP: '',
    IDRG_TOTAL_COST_WEIGHT: cwTertulis,
    IDRG_NBR: String(nbr),
    IDRG_TOTAL_TARIF: String(idrgTotalTarif),
    IDRG_GROUPER_VERSION: jsonKlinis.idrg.grouper_version,
    IDRG_LOGIC_VERSION: jsonKlinis.idrg.logic_version,
  };
}

function rusakkanJsonC2(c2: string): string {
  const bagian = c2.split('#');
  const json = bagian[13] ?? '';
  bagian[13] = json.slice(0, Math.max(10, Math.floor(json.length / 2)));
  return bagian.join('#');
}

export interface BerkasSintetis {
  teks: string;
  /** Baris data sebagai map nama-kolom-sumber -> nilai, setelah cacat diterapkan. */
  baris: Array<Record<string, string>>;
  header: string[];
}

/**
 * Bangun berkas E-Klaim sintetis sebagai teks.
 */
export function buatBerkasSintetis(map: ColumnMap, opsi: OpsiGenerator = {}): BerkasSintetis {
  const jumlah = opsi.jumlah ?? 10;
  const akhirBaris = opsi.akhirBaris ?? '\r\n';
  const cacat = opsi.cacat ?? [];
  const rnd = prng(opsi.benih ?? 20261028);
  const header = map.kolom.map((k) => k.sumber);

  const baris: Array<Record<string, string>> = [];
  for (let i = 1; i <= jumlah; i += 1) baris.push(buatBaris(i, rnd));

  const potongan: string[] = [];
  if (opsi.denganHeader !== false) potongan.push(header.join(map.pemisah_kolom));

  baris.forEach((b, idx) => {
    const nomor = idx + 1;
    let hapusSatuField = false;

    for (const c of cacat.filter((x) => x.baris === nomor)) {
      switch (c.jenis) {
        case 'jumlah_field_berbeda':
          hapusSatuField = true;
          break;
        case 'json_c2_rusak':
          b['C2'] = rusakkanJsonC2(b['C2'] ?? '');
          break;
        case 'c2_subfield_kurang':
          b['C2'] = (b['C2'] ?? '').split('#').slice(0, 8).join('#');
          break;
        case 'tarif_rs_tidak_cocok':
          b['TARIF_RS'] = String(Number(b['TARIF_RS']) + c.selisih);
          break;
        case 'total_tarif_tidak_cocok':
          b['TOTAL_TARIF'] = String(Number(b['TOTAL_TARIF']) + c.selisih);
          break;
        case 'los_tidak_cocok':
          b['LOS'] = String(c.nilai);
          break;
        case 'idrg_tidak_cocok':
          b['IDRG_TOTAL_TARIF'] = String(Number(b['IDRG_TOTAL_TARIF']) + c.selisih);
          break;
        case 'tanggal_tidak_sah':
          b['ADMISSION_DATE'] = '31/02/2026';
          break;
        case 'kode_inacbg_salah':
          b['INACBG'] = 'BUKAN-KODE';
          break;
        case 'ptd_tidak_dikenali':
          b['PTD'] = '9';
          break;
        case 'baris_kosong_setelah':
          break;
      }
    }

    const sel = header.map((h) => b[h] ?? '');
    if (hapusSatuField) sel.pop();
    potongan.push(sel.join(map.pemisah_kolom));

    if (cacat.some((x) => x.baris === nomor && x.jenis === 'baris_kosong_setelah')) {
      potongan.push('');
    }
  });

  return { teks: potongan.join(akhirBaris) + akhirBaris, baris, header };
}

/** Ubah teks menjadi byte ASCII (default) atau encoding lain untuk test. */
export function keBytes(teks: string, encoding: 'ascii' | 'utf8' | 'utf16le' = 'ascii'): Uint8Array {
  if (encoding === 'utf16le') {
    const buf = new Uint8Array(2 + teks.length * 2);
    buf[0] = 0xff;
    buf[1] = 0xfe;
    for (let i = 0; i < teks.length; i += 1) {
      const kode = teks.charCodeAt(i);
      buf[2 + i * 2] = kode & 0xff;
      buf[3 + i * 2] = kode >> 8;
    }
    return buf;
  }
  if (encoding === 'utf8') return new TextEncoder().encode(teks);
  const buf = new Uint8Array(teks.length);
  for (let i = 0; i < teks.length; i += 1) buf[i] = teks.charCodeAt(i) & 0xff;
  return buf;
}
