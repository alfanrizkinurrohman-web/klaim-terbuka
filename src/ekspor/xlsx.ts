/**
 * Ekspor Excel (.xlsx) tanpa pustaka spreadsheet.
 *
 * Sebuah berkas .xlsx hanyalah arsip ZIP berisi beberapa berkas XML. Menulisnya
 * sendiri dengan fflate — yang sudah dipakai untuk membongkar ZIP masukan —
 * jauh lebih ringan daripada menambah pustaka spreadsheet berukuran besar, dan
 * tetap 100% berjalan di peramban.
 *
 * Yang ditulis sengaja seminimal mungkin: satu lembar per tabel, sel teks dan
 * angka, tanpa gaya. Cukup untuk dibuka dan disaring di Excel atau LibreOffice.
 *
 * Catatan untuk test penjaga privasi di tests/privasi.test.ts: URL
 * schemas.openxmlformats.org di bawah ini adalah PENGENAL namespace XML yang
 * wajib ada dalam format OOXML, bukan alamat yang dihubungi. Tidak ada
 * permintaan jaringan dari berkas ini.
 */
import { zipSync } from 'fflate';

import { nilaiKeTeks } from './tabel';
import type { TabelEkspor } from './tabel';

const NS_CONTENT_TYPES = 'http://schemas.openxmlformats.org/package/2006/content-types';
const NS_RELATIONSHIPS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS_SPREADSHEET = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_DOC_RELATIONSHIPS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const TIPE_WORKBOOK =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';
const TIPE_WORKSHEET =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';

export const TIPE_MIME_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Karakter yang tidak sah di XML 1.0, dibuang agar berkas tidak rusak. */
const KARAKTER_TIDAK_SAH = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

function xml(teks: string): string {
  return teks
    .replace(KARAKTER_TIDAK_SAH, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Nama lembar Excel: maksimum 31 karakter, tanpa : \ / ? * [ ], tidak boleh
 * diawali atau diakhiri tanda kutip tunggal, dan tidak boleh kosong.
 */
export function namaLembarAman(nama: string, dipakai: Set<string> = new Set()): string {
  let bersih = nama.replace(/[:\\/?*[\]]/g, '-').replace(/^'+|'+$/g, '').trim();
  if (bersih === '') bersih = 'Lembar';
  bersih = bersih.slice(0, 31);

  if (!dipakai.has(bersih)) return bersih;
  for (let i = 2; i < 1000; i += 1) {
    const akhiran = `~${i}`;
    const calon = bersih.slice(0, 31 - akhiran.length) + akhiran;
    if (!dipakai.has(calon)) return calon;
  }
  return bersih.slice(0, 28) + '~xx';
}

/** Nama sel gaya A1 dari indeks kolom (0-based) dan nomor baris (1-based). */
export function alamatSel(kolom: number, baris: number): string {
  let n = kolom + 1;
  let huruf = '';
  while (n > 0) {
    const sisa = (n - 1) % 26;
    huruf = String.fromCharCode(65 + sisa) + huruf;
    n = Math.floor((n - 1) / 26);
  }
  return `${huruf}${baris}`;
}

/**
 * Angka ditulis sebagai angka agar bisa dijumlahkan di Excel. Teks yang
 * KEBETULAN berupa angka (mis. nomor rekam medis "0012345") tetap ditulis
 * sebagai teks supaya nol di depan tidak hilang.
 */
function selXml(alamat: string, nilai: unknown): string {
  if (nilai === null || nilai === undefined || nilai === '') return '';
  if (typeof nilai === 'number' && Number.isFinite(nilai)) {
    return `<c r="${alamat}"><v>${nilai}</v></c>`;
  }
  const teks = nilaiKeTeks(nilai as never);
  if (teks === '') return '';
  return `<c r="${alamat}" t="inlineStr"><is><t xml:space="preserve">${xml(teks)}</t></is></c>`;
}

function lembarXml(tabel: TabelEkspor): string {
  const baris: string[] = [];
  let nomor = 1;

  for (const c of tabel.catatan) {
    baris.push(`<row r="${nomor}">${selXml(alamatSel(0, nomor), c)}</row>`);
    nomor += 1;
  }
  if (tabel.catatan.length > 0) {
    baris.push(`<row r="${nomor}"/>`);
    nomor += 1;
  }

  const kepala = tabel.kolom
    .map((k, i) => selXml(alamatSel(i, nomor), k.label))
    .join('');
  baris.push(`<row r="${nomor}">${kepala}</row>`);
  const barisKepala = nomor;
  nomor += 1;

  for (const b of tabel.baris) {
    const sel = tabel.kolom
      .map((k, i) => selXml(alamatSel(i, nomor), b[k.nama] ?? null))
      .join('');
    baris.push(`<row r="${nomor}">${sel}</row>`);
    nomor += 1;
  }

  const kolomTerakhir = alamatSel(Math.max(0, tabel.kolom.length - 1), nomor - 1);
  const autoFilter =
    tabel.baris.length > 0
      ? `<autoFilter ref="${alamatSel(0, barisKepala)}:${kolomTerakhir}"/>`
      : '';

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<worksheet xmlns="${NS_SPREADSHEET}">` +
    `<sheetData>${baris.join('')}</sheetData>` +
    autoFilter +
    '</worksheet>'
  );
}

/** Bangun berkas .xlsx dari beberapa tabel; satu tabel = satu lembar. */
export function tabelKeXlsx(tabel: TabelEkspor[]): Uint8Array {
  if (tabel.length === 0) {
    throw new Error('Tidak ada tabel untuk diekspor.');
  }

  const dipakai = new Set<string>();
  const lembar = tabel.map((t, i) => {
    const nama = namaLembarAman(t.nama, dipakai);
    dipakai.add(nama);
    return { nama, nomor: i + 1, isi: lembarXml(t) };
  });

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<Types xmlns="${NS_CONTENT_TYPES}">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    `<Override PartName="/xl/workbook.xml" ContentType="${TIPE_WORKBOOK}"/>` +
    lembar
      .map(
        (l) =>
          `<Override PartName="/xl/worksheets/sheet${l.nomor}.xml" ContentType="${TIPE_WORKSHEET}"/>`,
      )
      .join('') +
    '</Types>';

  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<Relationships xmlns="${NS_RELATIONSHIPS}">` +
    `<Relationship Id="rId1" Type="${NS_DOC_RELATIONSHIPS}/officeDocument" Target="xl/workbook.xml"/>` +
    '</Relationships>';

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<workbook xmlns="${NS_SPREADSHEET}" xmlns:r="${NS_DOC_RELATIONSHIPS}">` +
    '<sheets>' +
    lembar
      .map(
        (l) =>
          `<sheet name="${xml(l.nama)}" sheetId="${l.nomor}" r:id="rId${l.nomor}"/>`,
      )
      .join('') +
    '</sheets></workbook>';

  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<Relationships xmlns="${NS_RELATIONSHIPS}">` +
    lembar
      .map(
        (l) =>
          `<Relationship Id="rId${l.nomor}" Type="${NS_DOC_RELATIONSHIPS}/worksheet" Target="worksheets/sheet${l.nomor}.xml"/>`,
      )
      .join('') +
    '</Relationships>';

  const teks = new TextEncoder();
  const isi: Record<string, Uint8Array> = {
    '[Content_Types].xml': teks.encode(contentTypes),
    '_rels/.rels': teks.encode(rels),
    'xl/workbook.xml': teks.encode(workbook),
    'xl/_rels/workbook.xml.rels': teks.encode(workbookRels),
  };
  for (const l of lembar) {
    isi[`xl/worksheets/sheet${l.nomor}.xml`] = teks.encode(l.isi);
  }

  return zipSync(isi, { level: 6 });
}
