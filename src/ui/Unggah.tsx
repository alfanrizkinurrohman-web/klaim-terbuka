import { useRef, useState } from 'react';

import type { BerkasMasuk } from '../app/zip';

interface Props {
  onBerkas: (berkas: BerkasMasuk[]) => void;
  sibuk: boolean;
  tahap: string;
}

/**
 * Pemilihan berkas. Tidak ada tombol "unggah": berkas dibaca langsung oleh
 * peramban, jadi istilahnya sengaja "pilih berkas", bukan "unggah", supaya
 * tidak menimbulkan kesan data dikirim ke server.
 */
export function Unggah({ onBerkas, sibuk, tahap }: Props): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const [seret, setSeret] = useState(false);

  async function proses(daftar: FileList | File[]): Promise<void> {
    const berkas: BerkasMasuk[] = [];
    for (const f of Array.from(daftar)) {
      berkas.push({ nama: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
    }
    if (berkas.length > 0) onBerkas(berkas);
  }

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        setSeret(true);
      }}
      onDragLeave={() => setSeret(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSeret(false);
        if (!sibuk) void proses(e.dataTransfer.files);
      }}
      className={`rounded-lg border-2 border-dashed p-8 text-center transition ${
        seret ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-white'
      }`}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept=".txt,.TXT,.zip,.ZIP"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void proses(e.target.files);
          e.target.value = '';
        }}
      />

      {sibuk ? (
        <div>
          <p className="text-lg font-medium text-slate-700">Memproses…</p>
          <p className="mt-1 text-sm text-slate-500">{tahap}</p>
        </div>
      ) : (
        <>
          <p className="text-lg font-medium text-slate-800">
            Pilih berkas ekspor E-Klaim (.TXT) atau arsip .ZIP
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            Berkas dibaca langsung di peramban ini. Tidak ada yang dikirim ke internet, dan
            tidak ada yang disimpan setelah halaman ditutup. Boleh memilih beberapa berkas
            sekaligus.
          </p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="mt-5 rounded-md bg-sky-700 px-5 py-2.5 font-medium text-white hover:bg-sky-800 focus:outline-2 focus:outline-offset-2 focus:outline-sky-700"
          >
            Pilih berkas
          </button>
          <p className="mt-3 text-xs text-slate-500">atau seret berkasnya ke kotak ini</p>
        </>
      )}
    </section>
  );
}
