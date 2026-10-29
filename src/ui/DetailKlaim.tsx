import { columnMap } from '../app/aset';
import { kolomDisamarkan, samarkanBaris } from '../privasi/mask';
import type { Klaim } from '../parser/types';
import type { BarisHasil } from '../db/types';
import { formatAngka, formatRupiah, formatTanggal, LABEL_CARA_MASUK, LABEL_CARA_PULANG, LABEL_PTD } from './format';

interface Props {
  klaim: Klaim | null;
  bukaSamaran: boolean;
  onTutup: () => void;
}

interface Kelompok {
  judul: string;
  kolom: string[];
}

/**
 * Pengelompokan kolom untuk tampilan detail. Hanya kolom yang berguna bagi
 * koder; kolom C1-C4 tidak ditampilkan karena isinya tidak untuk ditafsirkan.
 */
const KELOMPOK: Kelompok[] = [
  {
    judul: 'Identitas dan episode',
    kolom: [
      'berkas',
      'nomor_baris',
      'nama_pasien',
      'mrn',
      'sep',
      'nomor_kartu',
      'tanggal_lahir',
      'jenis_kelamin',
      'umur_tahun',
      'dpjp',
      'coder_id',
    ],
  },
  {
    judul: 'Pelayanan',
    kolom: [
      'ptd',
      'tanggal_masuk',
      'tanggal_pulang',
      'los',
      'kelas_rawat',
      'naik_kelas',
      'kelas_tujuan',
      'cara_masuk',
      'cara_pulang',
      'icu_indikator',
      'icu_los',
      'jam_ventilator',
      'ventilator_digunakan',
      'sistole',
      'diastole',
    ],
  },
  {
    judul: 'Pengkodean INA-CBG',
    kolom: [
      'kode_inacbg',
      'deskripsi_inacbg',
      'diagnosis_inacbg',
      'prosedur_inacbg',
      'kode_sp',
      'kode_sd',
      'versi_inacbg',
      'versi_grouper',
    ],
  },
  {
    judul: 'Pengkodean iDRG',
    kolom: [
      'idrg_drg_kode',
      'idrg_drg_deskripsi',
      'idrg_mdc_nomor',
      'idrg_mdc_deskripsi',
      'diagnosis_idrg',
      'prosedur_idrg',
      'idrg_cost_weight',
      'idrg_total_cost_weight',
      'idrg_nbr',
      'idrg_versi_grouper',
    ],
  },
  {
    judul: 'Tarif',
    kolom: ['tarif_rs', 'tarif_inacbg', 'tarif_sp', 'tarif_sd', 'total_tarif', 'idrg_total_tarif'],
  },
  {
    judul: 'Komponen biaya rumah sakit',
    kolom: [
      'komp_prosedur_non_bedah',
      'komp_prosedur_bedah',
      'komp_konsultasi',
      'komp_tenaga_ahli',
      'komp_keperawatan',
      'komp_penunjang',
      'komp_radiologi',
      'komp_laboratorium',
      'komp_pelayanan_darah',
      'komp_rehabilitasi',
      'komp_kamar_akomodasi',
      'komp_rawat_intensif',
      'komp_obat',
      'komp_alkes',
      'komp_bmhp',
      'komp_sewa_alat',
      'komp_obat_kronis',
      'komp_obat_kemo',
    ],
  },
  {
    judul: 'Persalinan',
    kolom: [
      'persalinan_gravida',
      'persalinan_partus',
      'persalinan_abortus',
      'persalinan_usia_kehamilan',
      'persalinan_onset_kontraksi',
      'persalinan_metode',
      'apgar_score',
    ],
  },
];

const KOLOM_RUPIAH = /^(tarif_|total_tarif|komp_|idrg_total_tarif)/;
const KOLOM_TANGGAL = /^tanggal_/;

function labelKolom(nama: string): string {
  const def = columnMap().kolom.find((k) => k.nama === nama);
  if (def) return def.sumber;
  const turunan = columnMap().kolom_turunan.find((k) => k.nama === nama);
  if (turunan) return `${nama} (dari C2)`;
  return nama;
}

function tampilkanNilai(nama: string, nilai: BarisHasil[string]): string {
  if (nilai === null || nilai === undefined || nilai === '') return '—';
  if (Array.isArray(nilai)) return nilai.length === 0 ? '—' : nilai.join('; ');
  if (nama === 'ptd') return LABEL_PTD[String(nilai)] ?? String(nilai);
  if (nama === 'cara_pulang') return LABEL_CARA_PULANG[String(nilai)] ?? String(nilai);
  if (nama === 'cara_masuk') return LABEL_CARA_MASUK[String(nilai)] ?? String(nilai);
  if (KOLOM_TANGGAL.test(nama)) return formatTanggal(nilai);
  if (KOLOM_RUPIAH.test(nama)) return formatRupiah(nilai);
  if (typeof nilai === 'number') return formatAngka(nilai);
  return String(nilai);
}

export function DetailKlaim({ klaim, bukaSamaran, onTutup }: Props): React.JSX.Element | null {
  if (!klaim) return null;

  const map = columnMap();
  const aman = samarkanBaris(klaim as unknown as BarisHasil, kolomDisamarkan(map), bukaSamaran);
  const jumlahKomponen = KELOMPOK[5]?.kolom.reduce((t, n) => {
    const v = klaim[n];
    return t + (typeof v === 'number' ? v : 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" role="dialog" aria-modal="true">
      <div className="flex h-full w-full max-w-3xl flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Detail klaim — baris {String(klaim.nomor_baris)}
            </h2>
            <p className="text-xs text-slate-500">{String(klaim.berkas)}</p>
          </div>
          <button
            type="button"
            onClick={onTutup}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Tutup
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!bukaSamaran ? (
            <p className="mb-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Kolom identitas disamarkan. Buka samaran lewat tombol di atas daftar temuan bila
              Anda perlu mencocokkan dengan rekam medis.
            </p>
          ) : null}

          {KELOMPOK.map((k) => {
            const isi = k.kolom.filter((nama) => nama in klaim);
            if (isi.length === 0) return null;
            return (
              <section key={k.judul} className="mb-6">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {k.judul}
                </h3>
                <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  {isi.map((nama) => (
                    <div
                      key={nama}
                      className="flex justify-between gap-4 border-b border-slate-100 py-1"
                    >
                      <dt className="text-sm text-slate-600">{labelKolom(nama)}</dt>
                      <dd className="whitespace-normal text-right text-sm font-medium text-slate-900">
                        {tampilkanNilai(nama, aman[nama] ?? null)}
                      </dd>
                    </div>
                  ))}
                </dl>
                {k.judul === 'Komponen biaya rumah sakit' ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Jumlah 18 komponen: {formatRupiah(jumlahKomponen ?? 0)} — harus sama dengan
                    Tarif RS {formatRupiah(klaim['tarif_rs'])}.
                  </p>
                ) : null}
              </section>
            );
          })}

          <p className="text-xs text-slate-400">
            Kolom C1–C4 tidak ditampilkan: C1 dan C4 adalah pengenal teknis, C3 artinya belum
            diketahui, dan sub-field sensitif pada C2 sudah dibuang saat pembacaan berkas.
          </p>
        </div>
      </div>
    </div>
  );
}
