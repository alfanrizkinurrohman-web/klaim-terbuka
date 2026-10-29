import { useState } from 'react';

import type { HasilAudit } from '../app/pipeline';
import { hitungTingkat, kelompokkanPeringatan } from '../app/pipeline';
import type { Peringatan } from '../parser/types';
import { formatAngka, formatDurasi, formatRupiah, formatTanggal } from './format';

const WARNA_TINGKAT: Record<Peringatan['tingkat'], string> = {
  galat: 'bg-rose-100 text-rose-900 border-rose-200',
  peringatan: 'bg-amber-100 text-amber-900 border-amber-200',
  info: 'bg-sky-100 text-sky-900 border-sky-200',
};

const LABEL_TINGKAT: Record<Peringatan['tingkat'], string> = {
  galat: 'Galat',
  peringatan: 'Peringatan',
  info: 'Info',
};

function Kartu({ judul, nilai, catatan }: { judul: string; nilai: string; catatan?: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{judul}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{nilai}</p>
      {catatan ? <p className="mt-1 text-xs text-slate-500">{catatan}</p> : null}
    </div>
  );
}

function DaftarPeringatan({
  judul,
  peringatan,
  kosong,
}: {
  judul: string;
  peringatan: Peringatan[];
  kosong: string;
}): React.JSX.Element {
  const [terbuka, setTerbuka] = useState<string | null>(null);
  const kelompok = kelompokkanPeringatan(peringatan);
  const hitung = hitungTingkat(peringatan);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h3 className="font-semibold text-slate-800">{judul}</h3>
        <div className="flex gap-2 text-xs">
          {hitung.galat > 0 ? (
            <span className="rounded bg-rose-100 px-2 py-1 text-rose-900">
              {hitung.galat} galat
            </span>
          ) : null}
          {hitung.peringatan > 0 ? (
            <span className="rounded bg-amber-100 px-2 py-1 text-amber-900">
              {hitung.peringatan} peringatan
            </span>
          ) : null}
        </div>
      </div>

      {kelompok.length === 0 ? (
        <p className="px-4 py-3 text-sm text-emerald-800">{kosong}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {kelompok.map((k) => (
            <li key={k.kode} className="px-4 py-3">
              <button
                type="button"
                onClick={() => setTerbuka(terbuka === k.kode ? null : k.kode)}
                className="flex w-full items-start gap-3 text-left"
              >
                <span
                  className={`mt-0.5 shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${WARNA_TINGKAT[k.tingkat]}`}
                >
                  {LABEL_TINGKAT[k.tingkat]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-800">
                    {k.kode}
                    <span className="ml-2 font-normal text-slate-500">
                      {formatAngka(k.jumlah)}&times;
                    </span>
                  </span>
                  <span className="mt-0.5 block whitespace-normal text-sm text-slate-600">
                    {k.pesanContoh}
                  </span>
                </span>
              </button>
              {terbuka === k.kode && k.barisContoh.length > 0 ? (
                <p className="mt-2 pl-[5.5rem] text-xs text-slate-500">
                  Contoh baris: {k.barisContoh.join(', ')}
                  {k.jumlah > k.barisContoh.length ? ', …' : ''}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RingkasanParsing({ hasil }: { hasil: HasilAudit }): React.JSX.Element {
  const berkas = hasil.ringkasanBerkas;
  const totalBaris = hasil.ringkasanBerkasParsing.reduce((t, r) => t + r.barisTotal, 0);
  const totalGagal = hasil.ringkasanBerkasParsing.reduce((t, r) => t + r.barisGagal, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kartu
          judul="Klaim terbaca"
          nilai={formatAngka(hasil.jumlahKlaim)}
          catatan={`dari ${formatAngka(totalBaris)} baris data`}
        />
        <Kartu
          judul="Baris gagal"
          nilai={formatAngka(totalGagal)}
          catatan={totalGagal === 0 ? 'semua baris terbaca' : 'lihat daftar galat di bawah'}
        />
        <Kartu judul="Berkas" nilai={formatAngka(hasil.ringkasanBerkasParsing.length)} />
        <Kartu judul="Lama proses" nilai={formatDurasi(hasil.durasiMs)} />
      </div>

      {berkas.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Berkas</th>
                <th className="px-4 py-2 font-medium">Klaim</th>
                <th className="px-4 py-2 font-medium">Ranap</th>
                <th className="px-4 py-2 font-medium">Rajal</th>
                <th className="px-4 py-2 font-medium">Pasien</th>
                <th className="px-4 py-2 font-medium">Versi INA-CBG</th>
                <th className="px-4 py-2 font-medium">Rentang tanggal</th>
                <th className="px-4 py-2 font-medium">Tarif RS</th>
                <th className="px-4 py-2 font-medium">Tarif INA-CBG</th>
                <th className="px-4 py-2 font-medium">Tarif iDRG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {berkas.map((b) => (
                <tr key={String(b['berkas'])}>
                  <td className="px-4 py-2 font-medium text-slate-800">{String(b['berkas'])}</td>
                  <td className="px-4 py-2">{formatAngka(b['jumlah_klaim'])}</td>
                  <td className="px-4 py-2">{formatAngka(b['jumlah_rawat_inap'])}</td>
                  <td className="px-4 py-2">{formatAngka(b['jumlah_rawat_jalan'])}</td>
                  <td className="px-4 py-2">{formatAngka(b['jumlah_pasien'])}</td>
                  <td className="px-4 py-2">
                    {formatAngka(b['jumlah_versi_inacbg'])}
                    {Number(b['jumlah_versi_inacbg']) > 1 ? (
                      <span className="ml-1 text-xs text-amber-700">(beberapa versi)</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    {formatTanggal(b['tanggal_masuk_paling_awal'])} –{' '}
                    {formatTanggal(b['tanggal_pulang_paling_akhir'])}
                  </td>
                  <td className="px-4 py-2">{formatRupiah(b['jumlah_tarif_rs'])}</td>
                  <td className="px-4 py-2">{formatRupiah(b['jumlah_tarif_inacbg'])}</td>
                  <td className="px-4 py-2">{formatRupiah(b['jumlah_tarif_idrg'])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <DaftarPeringatan
          judul="Pembacaan berkas"
          peringatan={hasil.peringatanParser}
          kosong="Berkas terbaca sesuai pola ekspor E-Klaim: ASCII, TAB, CRLF, 93 kolom."
        />
        <DaftarPeringatan
          judul="Relasi antar-kolom"
          peringatan={hasil.peringatanRelasi}
          kosong="Semua relasi terpenuhi: LOS, jumlah 18 komponen tarif, total tarif, dan tarif iDRG."
        />
      </div>

      {hasil.aturanDitolak.length > 0 ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <h3 className="font-semibold text-rose-900">Aturan yang ditolak</h3>
          <ul className="mt-2 space-y-1 text-sm text-rose-900">
            {hasil.aturanDitolak.map((a) => (
              <li key={a.jalur}>
                <span className="font-mono text-xs">{a.jalur}</span> — {a.pesan}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
