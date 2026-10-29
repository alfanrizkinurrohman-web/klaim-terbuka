# Ikut menyumbang

Dokumen ini ditujukan terutama untuk **koder dan tim casemix** — orang yang
tahu kejanggalan apa yang sering muncul di berkas klaim, tanpa harus bisa
memprogram.

Kalau Anda tahu satu pola yang sering bermasalah, Anda sudah punya modal utama
untuk menyumbang. Sisanya ada di halaman ini.

---

## Aturan pertama, sebelum yang lain

**Jangan pernah melampirkan berkas klaim asli** — tidak di isu, tidak di
permintaan perubahan, tidak di tangkapan layar, tidak di berkas contoh.

Berlaku juga untuk potongan kecil. Satu baris klaim sudah memuat nama pasien,
nomor rekam medis, nomor SEP, dan nomor kartu.

Bila Anda perlu menunjukkan contoh, tulis ulang dengan angka karangan, atau
sebutkan saja polanya dalam kalimat. Folder `samples/` sudah masuk
`.gitignore`, dan seluruh test memakai data sintetis.

---

## Tiga cara menyumbang, dari yang paling mudah

### 1. Mengusulkan aturan tanpa menyentuh kode sama sekali

Buka isu baru dan tulis:

- **Apa yang ingin ditandai.** Satu kalimat. Contoh: "klaim rawat inap yang
  tanggal pulangnya di hari yang sama dengan tanggal masuk."
- **Mengapa itu perlu diperiksa.** Apa yang biasanya salah di balik pola itu?
- **Mengapa itu belum tentu salah.** Sebutkan alasan-alasan yang sah. Bagian
  ini penting: aturan tanpa bagian ini akan melahirkan banyak temuan palsu.
- **Bukti apa yang perlu dibuka koder** untuk memastikannya. Sebutkan dokumen
  dan catatan yang konkret.
- **Dasar regulasinya**, kalau Anda tahu. Kalau tidak tahu, tulis saja tidak
  tahu — itu jauh lebih berguna daripada tebakan.

Itu sudah cukup. Orang lain bisa menerjemahkannya menjadi berkas aturan.

### 2. Melengkapi sumber regulasi aturan yang ada

Seluruh aturan saat ini berstatus `draft` karena dasar regulasinya belum
dipastikan. Kalau Anda tahu peraturan mana yang mengatur sebuah ambang:

1. Buka berkas aturannya di `rules/<kategori>/<id>.yaml`.
2. Isi `sumber_regulasi` dengan nomor dan judul peraturannya.
3. Ubah `status` menjadi `tervalidasi`.

Ini kontribusi yang paling dibutuhkan proyek ini.

### 3. Menulis aturan baru sendiri

Caranya di bawah.

---

## Menulis aturan baru

Satu aturan = satu berkas YAML di `rules/<kategori>/<id-aturan>.yaml`.

Mulailah dengan menyalin [`rules/_template.yaml`](rules/_template.yaml), yang
sudah berisi penjelasan tiap bagian.

### Bentuk sebuah aturan

```yaml
id: rawat-inap-los-1-hari          # pengenal, sama dengan nama berkas
judul: Rawat inap dengan lama rawat 1 hari
kategori: kelengkapan              # = nama foldernya
status: draft                      # draft atau tervalidasi
tingkat: temuan                    # temuan atau informasi
deskripsi: >-
  Penjelasan: apa yang ditandai, dan mengapa belum tentu salah.
sumber_regulasi: null              # nomor peraturan, atau null
query: |
  SELECT ... FROM klaim WHERE ...
kolom_output:
  - nama: nomor_baris
    label: Baris
    format: angka
bukti_yang_perlu_diperiksa:
  - Periksa di rekam medis apakah ... .
catatan_etika: >-
  Apa yang TIDAK boleh disimpulkan dari temuan ini.
```

### Apa arti `status`

`draft` berarti ambang atau rumusannya belum dipastikan terhadap regulasi.
Semua aturan mulai dari sini, dan UI menampilkan label "perlu validasi koder"
pada temuannya.

`tervalidasi` hanya boleh dipakai bila `sumber_regulasi` sudah terisi.
Aplikasi menolak aturan yang mengaku tervalidasi tanpa sumber.

**Jangan mengarang nomor peraturan.** Lebih baik satu aturan berstatus draft
selamanya daripada satu nomor peraturan palsu beredar di tim casemix.

### Apa arti `tingkat`

`temuan` berarti ada yang perlu diperiksa koder.

`informasi` berarti bukan kesalahan — hanya hal yang perlu diketahui.
Contohnya `perbedaan-daftar-diagnosis`: perbedaan pemetaan antara INA-CBG dan
iDRG adalah hal wajar pada masa transisi.

---

## Aturan etika penulisan

Ini bukan anjuran, melainkan syarat. Ada test yang memeriksanya.

**Rumuskan sebagai pemeriksaan, bukan perintah mengubah data.**

| Benar | Salah |
|---|---|
| "Periksa di rekam medis apakah ada perintah rawat inap tertulis dari DPJP." | "Ganti jenis rawat menjadi rawat jalan." |
| "Periksa rincian tagihan untuk komponen tersebut." | "Naikkan nilai komponen agar wajar." |
| "Periksa apakah diagnosis sekunder terdokumentasi di rekam medis." | "Tambahkan diagnosis sekunder agar severity naik." |

Setiap butir `bukti_yang_perlu_diperiksa` sebaiknya diawali kata **"Periksa"**.

**`catatan_etika` wajib menyebut apa yang tidak boleh disimpulkan.** Minimal:
bahwa temuan ini bukan kesimpulan adanya kesalahan, dan bahwa klaim yang
dokumentasinya lengkap tetap sah tanpa perlu diubah.

**Jangan menulis aturan yang tujuannya menaikkan nilai klaim.** Alat ini untuk
kelengkapan dokumentasi dan kesesuaian koding. Aturan yang menjanjikan
"optimalisasi klaim" akan ditolak.

---

## Menulis bagian `query`

Bagian ini butuh sedikit SQL. Kalau Anda belum pernah menulis SQL, lewati saja
dan pakai cara nomor 1 di atas — orang lain bisa membantu bagian ini.

### Yang perlu diketahui

Ada satu tabel utama bernama `klaim`, satu baris per klaim, dengan nama kolom
baku berbahasa Indonesia. Daftar lengkapnya ada di
[`config/column-map.yaml`](config/column-map.yaml); arti tiap kolom dijelaskan
di [`docs/format-eklaim.md`](docs/format-eklaim.md).

Beberapa kolom yang paling sering dipakai:

| Kolom | Isi |
|---|---|
| `nomor_baris`, `berkas` | Asal baris, untuk penelusuran balik. **Selalu sertakan.** |
| `ptd` | `'1'` rawat inap, `'2'` rawat jalan. **Satu-satunya penentu jenis rawat.** |
| `tanggal_masuk`, `tanggal_pulang`, `los` | Episode perawatan |
| `kode_inacbg`, `deskripsi_inacbg` | Hasil grouping INA-CBG |
| `diagnosis_inacbg`, `prosedur_inacbg` | Daftar kode (bertipe daftar) |
| `diagnosis_idrg`, `prosedur_idrg` | Daftar kode versi iDRG |
| `tarif_rs`, `total_tarif`, `idrg_total_tarif` | Tarif |
| `komp_*` | 18 komponen penyusun `tarif_rs` |
| `mrn`, `nama_pasien`, `sep`, `dpjp` | Identitas — tandai `identitas: true` |
| `cara_masuk`, `naik_kelas`, `sistole` | Kolom turunan dari C2 |

Ada juga tabel `hari_libur` dengan kolom `tanggal`, `keterangan`, dan `jenis`.
Bila Anda memakainya, setel `butuh_hari_libur: true`.

Mesinnya DuckDB, jadi sintaksnya mirip PostgreSQL.

### Yang akan ditolak

- Query yang tidak dimulai `SELECT` atau `WITH`.
- Kata kunci yang mengubah data: `INSERT`, `UPDATE`, `DELETE`, `DROP`,
  `CREATE`, `ATTACH`, `COPY`, dan sejenisnya. Aturan hanya boleh membaca.
- Lebih dari satu pernyataan dalam satu query.
- Kolom di `kolom_output` yang tidak ada di query.
- Parameter `{{...}}` yang tidak dideklarasikan, atau sebaliknya.

Pesan penolakannya menyebut berkas dan bagian mana yang bermasalah.

### Contoh dari aturan yang sudah ada

Menandai klaim rawat inap yang lama rawatnya satu hari:

```sql
SELECT nomor_baris, berkas, mrn, nama_pasien, sep,
       tanggal_masuk, tanggal_pulang, los, cara_pulang,
       kode_inacbg, total_tarif, dpjp
FROM klaim
WHERE ptd = '1'
  AND los = 1
ORDER BY nomor_baris
```

Membandingkan dua daftar kode tanpa memperhatikan urutan:

```sql
WHERE list_sort(diagnosis_inacbg) <> list_sort(diagnosis_idrg)
```

Mencari hari Minggu atau hari libur terdaftar:

```sql
FROM klaim k
LEFT JOIN hari_libur h ON h.tanggal = k.tanggal_masuk
WHERE k.ptd = '2'
  AND (isodow(k.tanggal_masuk) = 7 OR h.tanggal IS NOT NULL)
```

### Ambang yang bisa diatur

Bila aturan Anda punya angka ambang, jadikan parameter supaya pengguna bisa
menyesuaikannya tanpa mengubah berkas:

```yaml
parameter:
  - nama: ambang_hari
    deskripsi: Jarak maksimum dalam hari antara dua episode rawat inap.
    tipe: bilangan
    bawaan: 30
```

lalu pakai `{{ambang_hari}}` di query. Nilainya divalidasi sebelum masuk ke
SQL, jadi aman.

---

## Menguji aturan Anda

```bash
npm install
npm test
```

Test akan memuat seluruh berkas di `rules/` dan menolak yang tidak memenuhi
skema. Pesan galatnya menyebut nama berkas dan bagian yang salah.

Untuk melihatnya bekerja pada data:

```bash
npm run dev
```

lalu buka alamat yang muncul dan pilih berkas E-Klaim Anda. **Berkas Anda tidak
ke mana-mana** — lihat bagian privasi di [README.md](README.md).

### Menambahkan test untuk aturan Anda

Kalau Anda bisa, tambahkan test di `tests/aturan.test.ts`. Polanya: satu kasus
yang **memicu** aturan, dan satu yang **tidak**.

```ts
it('memicu pada rawat inap dengan LOS 1 hari', async () => {
  const hasil = await uji('rawat-inap-los-1-hari', [
    klaimUji(2, { ptd: '1', los: 1, tanggal_pulang: '2026-06-01' }),
    klaimUji(3, { ptd: '1', los: 3 }),
  ]);
  expect(barisTemuan(hasil.baris)).toEqual([2]);
});
```

`klaimUji()` membuat satu klaim sintetis yang tidak memicu aturan apa pun;
Anda cukup mengubah kolom yang relevan.

---

## Menyumbang perubahan kode

Berlaku syarat biasa, ditambah dua hal yang tidak bisa ditawar:

1. **Tidak ada jalur jaringan baru di `src/`.** Ada test yang menolak `fetch`,
   `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, dan URL. Bila
   Anda betul-betul butuh memuat aset, tambahkan pengecualian yang disertai
   alasan tertulis di `tests/privasi.test.ts` — jangan melonggarkan polanya.
2. **Jangan menyentuh sub-field sensitif pada kolom C2.** Sub-field ke-12 dan
   ke-13 dibuang sebelum nilai apa pun disimpan, karena memuat nama dan NIK
   dari registri TB.

Selain itu:

- Nama kolom E-Klaim hanya boleh ditulis di `config/column-map.yaml`, tidak di
  dalam kode.
- Jalankan `npm test` dan `npm run typecheck` sebelum mengirim perubahan.
- Antarmuka dan pesan untuk pengguna ditulis dalam Bahasa Indonesia.
- Buat perubahan kecil-kecil, satu gagasan per perubahan.

---

## Hal yang masih terbuka

Beberapa hal sengaja dibiarkan belum diputuskan karena perlu konfirmasi orang
yang memahami praktik di lapangan. Masukan Anda sangat berguna:

- **Aturan ICU** sudah dirumuskan ulang agar menyesuaikan diri dengan kebiasaan
  pembukuan di berkas yang diperiksa. Yang masih terbuka: adakah ketentuan yang
  mengatur di komponen mana biaya perawatan intensif seharusnya dibukukan?
- **Ambang readmisi 30 hari** belum ada dasar regulasinya.
- **Kelas rawat pada rawat jalan**: apakah ada ketentuan yang mengaturnya, atau
  itu sekadar kebiasaan pengisian aplikasi?
- **Kolom `C3`** bernilai 1–8 dan belum diketahui artinya.
- **Daftar hari libur** di `data/hari-libur/` masih kosong dan menunggu
  pengisian dari SKB 3 Menteri.

---

## Lisensi kontribusi

Dengan mengirim kontribusi, Anda setuju kontribusi itu dilisensikan sama dengan
bagian yang Anda sentuh: **AGPL-3.0-or-later** untuk kode, **CC BY-SA 4.0**
untuk isi folder `rules/`.
