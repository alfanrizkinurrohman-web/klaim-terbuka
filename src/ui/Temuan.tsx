import { useState } from 'react';

import type { TabelEkspor } from '../ekspor/tabel';
import type { HasilAturan, NilaiParameter } from '../rules/engine';
import { formatAngka } from './format';
import { TabelHasil } from './TabelHasil';

interface Props {
  temuan: HasilAturan[];
  /**
   * Menyiapkan tabel untuk ditampilkan. Jalur yang sama dengan ekspor, supaya
   * penyamaran identitas di layar dan di berkas tidak mungkin berbeda.
   */
  siapkan: (h: HasilAturan) => TabelEkspor;
  bukaSamaran: boolean;
  onUbahSamaran: (buka: boolean) => void;
  parameter: NilaiParameter;
  onUbahParameter: (idAturan: string, nama: string, nilai: number | string) => void;
  onJalankanUlang: () => void;
  adaPerubahanParameter: boolean;
  onPilihBaris: (nomorBaris: number) => void;
  onEksporCsv: (h: HasilAturan) => void;
  onEksporXlsx: (h: HasilAturan) => void;
  onEksporSemua: () => void;
}

function Lencana({
  teks,
  warna,
  judul,
}: {
  teks: string;
  warna: string;
  judul?: string;
}): React.JSX.Element {
  return (
    <span title={judul} className={`rounded px-1.5 py-0.5 text-xs font-medium ${warna}`}>
      {teks}
    </span>
  );
}

export function Temuan({
  temuan,
  siapkan,
  bukaSamaran,
  onUbahSamaran,
  parameter,
  onUbahParameter,
  onJalankanUlang,
  adaPerubahanParameter,
  onPilihBaris,
  onEksporCsv,
  onEksporXlsx,
  onEksporSemua,
}: Props): React.JSX.Element {
  const [terpilih, setTerpilih] = useState<string | null>(temuan[0]?.aturan.id ?? null);
  const [konfirmasiSamaran, setKonfirmasiSamaran] = useState(false);

  const aktif = temuan.find((h) => h.aturan.id === terpilih) ?? temuan[0];
  const totalTemuan = temuan
    .filter((h) => h.aturan.tingkat === 'temuan')
    .reduce((t, h) => t + h.jumlah, 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Hasil pemeriksaan aturan</h2>
          <p className="mt-1 text-sm text-slate-600">
            {formatAngka(totalTemuan)} hal yang perlu diperiksa dari {temuan.length} aturan.
            Seluruh aturan masih berstatus draft dan perlu validasi koder.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEksporSemua}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Ekspor semua ke Excel
          </button>
          {bukaSamaran ? (
            <button
              type="button"
              onClick={() => onUbahSamaran(false)}
              className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm text-rose-900 hover:bg-rose-100"
            >
              Samarkan kembali identitas
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setKonfirmasiSamaran(true)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Buka samaran identitas
            </button>
          )}
        </div>
      </div>

      {konfirmasiSamaran && !bukaSamaran ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-950">
            Membuka samaran akan menampilkan nama pasien, nomor rekam medis, nomor SEP, nomor
            kartu, tanggal lahir, serta kode DPJP dan koder — dan nilai itu akan ikut terbawa ke
            berkas ekspor. Pastikan layar Anda tidak terlihat orang lain dan berkas hasil ekspor
            disimpan sesuai ketentuan kerahasiaan rekam medis.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                onUbahSamaran(true);
                setKonfirmasiSamaran(false);
              }}
              className="rounded-md bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800"
            >
              Ya, buka samaran
            </button>
            <button
              type="button"
              onClick={() => setKonfirmasiSamaran(false)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Batal
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <ul className="space-y-1.5">
          {temuan.map((h) => {
            const dipilih = h.aturan.id === aktif?.aturan.id;
            return (
              <li key={h.aturan.id}>
                <button
                  type="button"
                  onClick={() => setTerpilih(h.aturan.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    dipilih
                      ? 'border-sky-600 bg-sky-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="whitespace-normal font-medium text-slate-800">
                      {h.aturan.judul}
                    </span>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-sm font-semibold ${
                        h.galat
                          ? 'bg-rose-100 text-rose-900'
                          : h.jumlah === 0
                            ? 'bg-emerald-100 text-emerald-900'
                            : h.aturan.tingkat === 'informasi'
                              ? 'bg-sky-100 text-sky-900'
                              : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {h.galat ? '!' : formatAngka(h.jumlah)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Lencana teks={h.aturan.kategori} warna="bg-slate-100 text-slate-700" />
                    {h.aturan.status === 'draft' ? (
                      <Lencana
                        teks="draft"
                        warna="bg-violet-100 text-violet-900"
                        judul="Perlu validasi koder"
                      />
                    ) : null}
                    {h.aturan.tingkat === 'informasi' ? (
                      <Lencana teks="informasi" warna="bg-sky-100 text-sky-900" />
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {aktif ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-900">{aktif.aturan.judul}</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onEksporCsv(aktif)}
                    disabled={aktif.baris.length === 0}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
                  >
                    Ekspor CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => onEksporXlsx(aktif)}
                    disabled={aktif.baris.length === 0}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
                  >
                    Ekspor Excel
                  </button>
                </div>
              </div>

              <p className="mt-2 text-sm text-slate-700">{aktif.aturan.deskripsi}</p>

              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex gap-2">
                  <dt className="shrink-0 text-slate-500">Sumber regulasi:</dt>
                  <dd className="text-slate-800">
                    {aktif.aturan.sumber_regulasi ?? (
                      <span className="text-violet-900">
                        belum dicantumkan — aturan berstatus draft
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              {aktif.catatan.map((c) => (
                <p
                  key={c}
                  className="mt-2 rounded border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950"
                >
                  {c}
                </p>
              ))}
              {aktif.aturan.catatan ? (
                <p className="mt-2 whitespace-normal rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {aktif.aturan.catatan}
                </p>
              ) : null}

              {aktif.aturan.parameter.length > 0 ? (
                <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-700">Ambang yang bisa diatur</p>
                  {aktif.aturan.parameter.map((p) => (
                    <label key={p.nama} className="mt-2 block text-sm">
                      <span className="text-slate-600">{p.deskripsi}</span>
                      <input
                        type={p.tipe === 'bilangan' ? 'number' : 'text'}
                        value={String(parameter[aktif.aturan.id]?.[p.nama] ?? p.bawaan)}
                        onChange={(e) =>
                          onUbahParameter(
                            aktif.aturan.id,
                            p.nama,
                            p.tipe === 'bilangan' ? Number(e.target.value) : e.target.value,
                          )
                        }
                        className="mt-1 block w-40 rounded border border-slate-300 px-2 py-1"
                      />
                    </label>
                  ))}
                  {adaPerubahanParameter ? (
                    <button
                      type="button"
                      onClick={onJalankanUlang}
                      className="mt-3 rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800"
                    >
                      Jalankan ulang aturan
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Bukti yang perlu diperiksa
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {aktif.aturan.bukti_yang_perlu_diperiksa.map((b) => (
                      <li key={b} className="whitespace-normal">
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Catatan etika</p>
                  <p className="mt-1 whitespace-normal text-sm text-slate-700">
                    {aktif.aturan.catatan_etika}
                  </p>
                </div>
              </div>
            </div>

            {aktif.galat ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                Aturan ini gagal dijalankan: {aktif.galat}
              </p>
            ) : aktif.baris.length === 0 ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Tidak ada klaim yang memenuhi aturan ini.
              </p>
            ) : (
              <>
                {aktif.terpotong ? (
                  <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Temuan dipotong pada {formatAngka(aktif.baris.length)} baris dari{' '}
                    {formatAngka(aktif.jumlah)}. Ekspor berkas untuk melihat seluruhnya.
                  </p>
                ) : null}
                <TabelHasil
                  kolom={siapkan(aktif).kolom}
                  baris={siapkan(aktif).baris}
                  onPilihBaris={onPilihBaris}
                />
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
