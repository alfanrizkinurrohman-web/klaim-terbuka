import { useCallback, useMemo, useRef, useState } from 'react';

import { columnMap } from './app/aset';
import { jalankanAudit } from './app/pipeline';
import type { HasilAudit } from './app/pipeline';
import type { BerkasMasuk } from './app/zip';
import { buatKoneksiBrowser } from './db/duckdbBrowser';
import type { KoneksiKlaim } from './db/types';
import {
  eksporCsv,
  eksporXlsx,
  tabelDariAturan,
  tabelDariDpjp,
} from './ekspor/aksi';
import type { HasilAturan, NilaiParameter } from './rules/engine';
import { DetailKlaim } from './ui/DetailKlaim';
import { Dpjp } from './ui/Dpjp';
import { RingkasanParsing } from './ui/RingkasanParsing';
import { Temuan } from './ui/Temuan';
import { Unggah } from './ui/Unggah';

type Tab = 'ringkasan' | 'temuan' | 'dpjp';

export function App(): React.JSX.Element {
  const koneksi = useRef<KoneksiKlaim | null>(null);
  const berkasTerakhir = useRef<BerkasMasuk[]>([]);

  const [sibuk, setSibuk] = useState(false);
  const [tahap, setTahap] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [hasil, setHasil] = useState<HasilAudit | null>(null);
  const [tab, setTab] = useState<Tab>('ringkasan');
  const [bukaSamaran, setBukaSamaran] = useState(false);
  const [parameter, setParameter] = useState<NilaiParameter>({});
  const [parameterBerubah, setParameterBerubah] = useState(false);
  const [barisDetail, setBarisDetail] = useState<number | null>(null);

  const map = useMemo(() => columnMap(), []);

  const proses = useCallback(
    async (berkas: BerkasMasuk[], parameterDipakai: NilaiParameter) => {
      setSibuk(true);
      setGalat(null);
      try {
        koneksi.current ??= await buatKoneksiBrowser();
        const audit = await jalankanAudit(berkas, koneksi.current, {
          parameter: parameterDipakai,
          lapor: setTahap,
        });
        setHasil(audit);
        setParameterBerubah(false);
        setTab(audit.jumlahKlaim > 0 ? 'ringkasan' : 'ringkasan');
      } catch (e) {
        setGalat((e as Error).message);
      } finally {
        setSibuk(false);
        setTahap('');
      }
    },
    [],
  );

  const onBerkas = useCallback(
    (berkas: BerkasMasuk[]) => {
      berkasTerakhir.current = berkas;
      void proses(berkas, parameter);
    },
    [parameter, proses],
  );

  const jalankanUlang = useCallback(() => {
    if (berkasTerakhir.current.length > 0) void proses(berkasTerakhir.current, parameter);
  }, [parameter, proses]);

  const siapkanTabelAturan = useCallback(
    (h: HasilAturan) => tabelDariAturan(h, map, bukaSamaran),
    [map, bukaSamaran],
  );

  const klaimDetail = useMemo(() => {
    if (barisDetail === null || !hasil) return null;
    return hasil.klaim.find((k) => k.nomor_baris === barisDetail) ?? null;
  }, [barisDetail, hasil]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl font-semibold text-slate-900">klaim-terbuka</h1>
            <p className="text-sm text-slate-500">
              Audit mandiri berkas ekspor E-Klaim (INA-CBG + iDRG)
            </p>
          </div>
          <p className="mt-2 max-w-4xl text-sm text-slate-600">
            Seluruh pemrosesan berjalan di peramban Anda. Data klaim tidak dikirim ke internet,
            tidak disimpan di server mana pun, dan hilang begitu halaman ditutup. Alat ini{' '}
            <strong className="font-semibold">alat bantu, bukan pengganti penilaian koder dan
            verifikator</strong>.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Unggah onBerkas={onBerkas} sibuk={sibuk} tahap={tahap} />

        {galat ? (
          <div className="rounded-lg border border-rose-300 bg-rose-50 p-4">
            <p className="font-medium text-rose-900">Pemrosesan gagal</p>
            <p className="mt-1 whitespace-normal text-sm text-rose-900">{galat}</p>
          </div>
        ) : null}

        {hasil && hasil.jumlahKlaim === 0 && !sibuk ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            Tidak ada klaim yang berhasil dibaca dari berkas yang dipilih. Periksa daftar galat
            pembacaan berkas di bawah.
          </div>
        ) : null}

        {hasil && hasil.hariLiburMasihPlaceholder ? (
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
            Daftar hari libur nasional belum diisi. Berkas{' '}
            <code className="rounded bg-violet-100 px-1">data/hari-libur/2026.json</code> masih
            placeholder dan harus diisi dari SKB 3 Menteri. Selama belum diisi, aturan hari libur
            hanya mendeteksi hari Minggu.
          </div>
        ) : null}

        {hasil ? (
          <>
            <nav className="flex gap-1 border-b border-slate-200">
              {(
                [
                  ['ringkasan', 'Ringkasan berkas'],
                  ['temuan', `Temuan aturan (${hasil.temuan.length})`],
                  ['dpjp', 'Ringkasan DPJP'],
                ] as Array<[Tab, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                    tab === id
                      ? 'border-sky-700 text-sky-800'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>

            {tab === 'ringkasan' ? <RingkasanParsing hasil={hasil} /> : null}

            {tab === 'temuan' && hasil.temuan.length > 0 ? (
              <Temuan
                temuan={hasil.temuan}
                siapkan={siapkanTabelAturan}
                bukaSamaran={bukaSamaran}
                onUbahSamaran={setBukaSamaran}
                parameter={parameter}
                onUbahParameter={(idAturan, nama, nilai) => {
                  setParameter((lama) => ({
                    ...lama,
                    [idAturan]: { ...(lama[idAturan] ?? {}), [nama]: nilai },
                  }));
                  setParameterBerubah(true);
                }}
                onJalankanUlang={jalankanUlang}
                adaPerubahanParameter={parameterBerubah}
                onPilihBaris={setBarisDetail}
                onEksporCsv={(h) => eksporCsv(tabelDariAturan(h, map, bukaSamaran))}
                onEksporXlsx={(h) => eksporXlsx([tabelDariAturan(h, map, bukaSamaran)], h.aturan.id)}
                onEksporSemua={() =>
                  eksporXlsx(
                    hasil.temuan
                      .filter((h) => h.baris.length > 0)
                      .map((h) => tabelDariAturan(h, map, bukaSamaran)),
                    'temuan-klaim-terbuka',
                  )
                }
              />
            ) : null}

            {tab === 'dpjp' ? (
              <Dpjp
                baris={tabelDariDpjp(hasil.ringkasanDpjp, map, bukaSamaran).baris}
                onEksporCsv={() => eksporCsv(tabelDariDpjp(hasil.ringkasanDpjp, map, bukaSamaran))}
                onEksporXlsx={() =>
                  eksporXlsx(
                    [tabelDariDpjp(hasil.ringkasanDpjp, map, bukaSamaran)],
                    'ringkasan-dpjp',
                  )
                }
              />
            ) : null}
          </>
        ) : null}
      </main>

      <DetailKlaim
        klaim={klaimDetail}
        bukaSamaran={bukaSamaran}
        onTutup={() => setBarisDetail(null)}
      />

      <footer className="mt-8 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl space-y-2 px-4 py-6 text-xs text-slate-500">
          <p>
            Temuan di alat ini adalah permintaan pemeriksaan dokumen, bukan kesimpulan bahwa ada
            kesalahan, dan bukan saran untuk mengubah kode. Keputusan pengkodean tetap mengikuti
            apa yang terdokumentasi di rekam medis.
          </p>
          <p>
            Kode program berlisensi AGPL-3.0-or-later. Berkas aturan di folder{' '}
            <code>rules/</code> berlisensi CC BY-SA 4.0.
          </p>
        </div>
      </footer>
    </div>
  );
}
