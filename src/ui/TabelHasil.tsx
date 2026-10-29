import type { BarisHasil } from '../db/types';
import type { KolomTabel } from '../ekspor/tabel';
import { formatSel } from './format';

interface Props {
  kolom: KolomTabel[];
  baris: BarisHasil[];
  /** Dipanggil saat pengguna ingin melihat detail satu klaim. */
  onPilihBaris?: (nomorBaris: number) => void;
  /** Jumlah baris yang ditampilkan sekaligus. */
  batasTampil?: number;
}

const RATA_KANAN = new Set(['angka', 'rupiah']);

export function TabelHasil({
  kolom,
  baris,
  onPilihBaris,
  batasTampil = 200,
}: Props): React.JSX.Element {
  const tampil = baris.slice(0, batasTampil);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {onPilihBaris ? <th className="px-3 py-2 font-medium">Detail</th> : null}
              {kolom.map((k) => (
                <th
                  key={k.nama}
                  className={`px-3 py-2 font-medium ${RATA_KANAN.has(k.format ?? 'teks') ? 'text-right' : ''}`}
                >
                  {k.label}
                  {k.identitas ? (
                    <span
                      title="Kolom identitas, disamarkan"
                      className="ml-1 text-slate-400"
                      aria-label="kolom identitas"
                    >
                      &#9679;
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tampil.map((b, i) => (
              <tr key={`${String(b['berkas'])}-${String(b['nomor_baris'])}-${i}`} className="hover:bg-slate-50">
                {onPilihBaris ? (
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onPilihBaris(Number(b['nomor_baris']))}
                      className="rounded border border-slate-300 px-2 py-0.5 text-xs text-sky-800 hover:bg-sky-50"
                    >
                      Lihat
                    </button>
                  </td>
                ) : null}
                {kolom.map((k) => (
                  <td
                    key={k.nama}
                    className={`px-3 py-2 ${RATA_KANAN.has(k.format ?? 'teks') ? 'text-right tabular-nums' : ''} ${
                      k.identitas ? 'text-slate-500' : 'text-slate-800'
                    }`}
                  >
                    {formatSel(k, b)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {baris.length > tampil.length ? (
        <p className="mt-2 text-xs text-slate-500">
          Menampilkan {tampil.length} dari {baris.length} baris. Ekspor berkas untuk melihat
          seluruhnya.
        </p>
      ) : null}
    </div>
  );
}
