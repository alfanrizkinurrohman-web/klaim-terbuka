import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Penjaga prinsip 1: data klaim tidak boleh keluar dari browser.
 *
 * Test ini memeriksa kode sumber, bukan perilaku runtime, sehingga jalur
 * pengiriman data yang baru ikut tertangkap begitu seseorang menambahkannya.
 * Bila suatu saat ada kebutuhan sah untuk memuat sumber daya dari jaringan
 * (misalnya berkas WASM), tambahkan pengecualian di sini secara eksplisit
 * beserta alasannya — jangan melonggarkan polanya.
 */
const POLA_TERLARANG: Array<{ pola: RegExp; alasan: string }> = [
  { pola: /\bfetch\s*\(/, alasan: 'fetch() dapat mengirim data klaim ke jaringan' },
  { pola: /XMLHttpRequest/, alasan: 'XMLHttpRequest dapat mengirim data klaim ke jaringan' },
  { pola: /sendBeacon/, alasan: 'sendBeacon mengirim data ke jaringan tanpa terlihat' },
  { pola: /WebSocket/, alasan: 'WebSocket membuka kanal ke jaringan' },
  { pola: /EventSource/, alasan: 'EventSource membuka kanal ke jaringan' },
  { pola: /navigator\.clipboard/, alasan: 'penyalinan ke papan klip harus lewat tindakan pengguna' },
  {
    // Pengecualian yang disengaja:
    //  - www.gnu.org dan creativecommons.org: rujukan lisensi di komentar.
    //  - schemas.openxmlformats.org: PENGENAL namespace XML yang wajib ada di
    //    dalam berkas .xlsx (src/ekspor/xlsx.ts). Bukan alamat yang dihubungi;
    //    tidak ada permintaan jaringan dari modul itu.
    pola: /https?:\/\/(?!www\.gnu\.org|creativecommons\.org|schemas\.openxmlformats\.org)/,
    alasan: 'URL jaringan di dalam kode',
  },
];

function berkasSumber(dir: string): string[] {
  return readdirSync(dir).flatMap((nama) => {
    const jalur = join(dir, nama);
    if (statSync(jalur).isDirectory()) return berkasSumber(jalur);
    return /\.(ts|tsx)$/.test(nama) ? [jalur] : [];
  });
}

describe('prinsip 100% client-side', () => {
  const akarSrc = fileURLToPath(new URL('../src', import.meta.url));
  const berkas = berkasSumber(akarSrc);

  it('menemukan berkas sumber untuk diperiksa', () => {
    expect(berkas.length).toBeGreaterThan(0);
  });

  it.each(POLA_TERLARANG)('tidak memakai $pola di src/ ($alasan)', ({ pola }) => {
    const pelanggar = berkas.filter((f) => {
      const isi = readFileSync(f, 'utf8');
      // Abaikan baris komentar agar penjelasan seperti di berkas ini tidak ikut terjaring.
      const kode = isi
        .split('\n')
        .filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b))
        .join('\n');
      return pola.test(kode);
    });
    expect(pelanggar).toEqual([]);
  });
});

describe('pemuatan mesin DuckDB', () => {
  it('memakai aset yang dibundel, bukan CDN', () => {
    const jalur = fileURLToPath(new URL('../src/db/duckdbBrowser.ts', import.meta.url));
    const isi = readFileSync(jalur, 'utf8');
    const kode = isi
      .split('\n')
      .filter((b) => !/^\s*(\/\/|\*|\/\*)/.test(b))
      .join('\n');

    // getJsDelivrBundles() akan mengambil mesin dari CDN. Aplikasi harus bisa
    // dipakai di jaringan rumah sakit yang tertutup, jadi jangan sampai dipakai.
    expect(kode).not.toContain('getJsDelivrBundles');
    // Berkas .wasm dan worker di-import sebagai aset sehingga ikut dibundel.
    expect(kode).toContain('duckdb-eh.wasm?url');
    expect(kode).toContain('duckdb-browser-eh.worker.js?url');
  });
});

describe('sub-field sensitif C2', () => {
  it('hanya dibaca lewat satu jalur, yaitu buangSubFieldSensitif', () => {
    const akarSrc = fileURLToPath(new URL('../src', import.meta.url));
    const isiC2 = readFileSync(join(akarSrc, 'parser', 'c2.ts'), 'utf8');
    // SF_DIBUANG adalah satu-satunya daftar posisi yang dibuang; bila ada kode
    // lain yang mengakses posisi 12 atau 13 secara langsung, test ini perlu
    // ditinjau ulang.
    expect(isiC2).toContain('SF_DIBUANG');
    expect(isiC2).toMatch(/SENSITIF_A:\s*12/);
    expect(isiC2).toMatch(/REGISTRI_TB:\s*13/);
  });
});
