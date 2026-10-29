import type { BarisHasil } from '../db/types';
import { CATATAN_RINGKASAN_DPJP, KOLOM_RINGKASAN_DPJP } from '../rules/ringkasan';
import { TabelHasil } from './TabelHasil';

interface Props {
  baris: BarisHasil[];
  onEksporCsv: () => void;
  onEksporXlsx: () => void;
}

export function Dpjp({ baris, onEksporCsv, onEksporXlsx }: Props): React.JSX.Element {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ringkasan per DPJP</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{CATATAN_RINGKASAN_DPJP}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onEksporCsv}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Ekspor CSV
          </button>
          <button
            type="button"
            onClick={onEksporXlsx}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Ekspor Excel
          </button>
        </div>
      </div>
      <TabelHasil kolom={KOLOM_RINGKASAN_DPJP} baris={baris} batasTampil={100} />
    </section>
  );
}
