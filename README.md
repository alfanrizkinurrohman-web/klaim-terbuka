# klaim-terbuka

Alat bantu audit mandiri berkas ekspor **E-Klaim** (INA-CBG + iDRG) untuk tim
casemix rumah sakit. Berkas TXT hasil ekspor diperiksa **sebelum** klaim
dikirim, supaya kekurangan dokumentasi dan kejanggalan data ketahuan lebih
dulu — oleh rumah sakit sendiri, bukan oleh verifikator.

Gratis, sumber terbuka, dan **berjalan sepenuhnya di peramban Anda**.

---

## Yang paling penting lebih dulu

### 1. Data klaim tidak pernah keluar dari komputer Anda

Tidak ada server. Tidak ada unggahan. Tidak ada analitik, telemetri, maupun
"pengiriman laporan galat". Berkas yang Anda pilih dibaca langsung oleh
peramban, diproses di memori, dan hilang begitu tab ditutup.

Ini bukan sekadar janji di README. Buktinya bisa Anda periksa sendiri:

**Cara memeriksa dalam dua menit**

1. Buka aplikasi, lalu tekan `F12` untuk membuka DevTools.
2. Pindah ke tab **Network**, centang **Preserve log**.
3. Pilih berkas E-Klaim Anda, tunggu sampai selesai diproses.
4. Pilih berkas kedua. Perhatikan: **tidak ada satu pun request baru** yang
   muncul. Semua request yang ada hanyalah berkas aplikasi itu sendiri
   (JavaScript, CSS, dan mesin basis data), semuanya dari alamat yang sama
   dengan halaman ini.

Pengukuran kami pada build produksi: seumur hidup halaman hanya ada **3
request**, seluruhnya ke origin sendiri. Memproses berkas kedua menambah
**0 request**.

Pemeriksaan paling meyakinkan: **putuskan koneksi internet** setelah halaman
termuat, lalu proses berkas Anda. Aplikasi tetap berjalan normal.

Di sisi kode, ada test yang menolak masuknya `fetch`, `XMLHttpRequest`,
`sendBeacon`, `WebSocket`, `EventSource`, dan URL jaringan ke dalam `src/`.
Kalau ada yang menambahkannya, test langsung gagal.

### 2. Kolom identitas disamarkan secara bawaan

Nama pasien, nomor rekam medis, nomor SEP, nomor kartu, tanggal lahir, serta
kode DPJP dan koder ditampilkan tersamar. Membukanya memerlukan konfirmasi,
dan berkas hasil ekspornya otomatis diberi penanda `-TIDAK-TERSAMAR` pada
namanya agar tidak tertukar.

Satu hal yang dibuang bahkan sebelum diproses: kolom `C2` pada berkas E-Klaim
memuat respons registri TB yang **berisi nama dan NIK**. Parser membuangnya
sebelum nilai apa pun disimpan. Tidak ada jalur kode yang membacanya.

### 3. Alat bantu, bukan pengganti penilaian koder dan verifikator

Alat ini **tidak** menentukan klaim mana yang benar dan mana yang salah. Yang
dilakukannya hanya menandai klaim yang **perlu dilihat lagi**, lalu menyebut
bukti apa yang sebaiknya diperiksa di rekam medis.

Setiap temuan dirumuskan sebagai *"periksa bukti X"*, bukan *"ganti kode
menjadi Y"*. Ini alat untuk **kelengkapan dokumentasi dan kesesuaian koding** —
bukan alat untuk menaikkan nilai klaim.

Keputusan pengkodean tetap mengikuti apa yang terdokumentasi di rekam medis.

### 4. Seluruh aturan masih berstatus draft

Delapan aturan yang tersedia saat ini **semuanya** berstatus `draft` dengan
`sumber_regulasi: null`. Artinya: ambang dan rumusannya adalah pilihan desain
yang masuk akal, **bukan kutipan dari peraturan**. Tidak ada nomor peraturan
yang dikarang.

Sebuah aturan baru boleh berstatus `tervalidasi` setelah ada orang yang
memastikan dasar regulasinya dan menuliskannya di berkas aturan. Sampai itu
terjadi, UI menampilkan label "perlu validasi koder" pada setiap temuan.

---

## Cara memakai

1. Buka aplikasi di peramban.
2. Pilih satu atau beberapa berkas `.TXT` hasil ekspor E-Klaim, atau arsip
   `.ZIP` yang memuatnya. Bisa juga diseret ke kotak unggah.
3. Lihat **Ringkasan berkas**: berapa klaim terbaca, apakah ada baris yang
   gagal dibaca, dan apakah ada relasi antar-kolom yang tidak terpenuhi.
4. Buka **Temuan aturan**: pilih aturan di kiri, baca penjelasan dan bukti yang
   perlu diperiksa, lalu telusuri daftar klaimnya. Klik **Lihat** untuk melihat
   seluruh isi satu klaim.
5. **Ringkasan DPJP** memperlihatkan jumlah kasus, sebaran severity, dan
   perbandingan tarif RS, INA-CBG, dan iDRG per DPJP.
6. Ekspor ke CSV atau Excel bila perlu dibahas bersama tim.

Mulailah dari **Ringkasan berkas**. Kalau di sana ada banyak galat pembacaan,
temuan aturannya belum bisa dipercaya.

---

## Delapan aturan yang tersedia

| Aturan | Yang ditandai |
|---|---|
| `duplikasi-klaim` | Klaim dengan No. RM, tanggal masuk, dan jenis rawat yang sama |
| `rawat-jalan-hari-libur` | Rawat jalan pada hari Minggu atau hari libur nasional |
| `rawat-inap-berulang` | Rawat inap berulang dalam rentang hari tertentu (bawaan 30) |
| `icu-tanpa-komponen-rawat-intensif` | Indikator ICU terisi tetapi komponen rawat intensif nol |
| `rawat-inap-los-1-hari` | Rawat inap dengan lama rawat 1 hari |
| `rawat-jalan-kelas-rawat` | Rawat jalan dengan kelas rawat bukan kelas 3 |
| `komponen-tarif-tidak-wajar` | Komponen biaya > 0 tetapi di bawah ambang kewajaran |
| `perbedaan-daftar-diagnosis` | Daftar diagnosis INA-CBG berbeda dari iDRG (informasi, bukan kesalahan) |

Ambang pada aturan yang memilikinya bisa diubah langsung di UI, lalu aturan
dijalankan ulang.

Aturan `perbedaan-daftar-diagnosis` bertingkat **informasi**: perbedaan
pemetaan antara kedua grouper adalah hal wajar pada masa transisi iDRG, bukan
kesalahan yang perlu diperbaiki.

### Yang perlu diperhatikan pada aturan ICU

Pada berkas uji kami, kolom komponen rawat intensif bernilai nol di **seluruh**
klaim, sementara sebagian klaim ber-indikator ICU. Akibatnya aturan ini memicu
pada semua kasus ICU. Kemungkinan besar biaya perawatan intensif memang
dibukukan pada komponen kamar dan akomodasi.

Kolom biaya kamar, lama rawat ICU, dan jam ventilator ikut ditampilkan di
temuan supaya kedua kemungkinan itu bisa dipilah. **Periksa dulu bagaimana
rumah sakit Anda membukukan biaya ICU** sebelum menganggap temuan ini berarti.

---

## Hari libur nasional belum terisi

Berkas [`data/hari-libur/2026.json`](data/hari-libur/2026.json) sengaja
**kosong**. Daftar hari libur nasional dan cuti bersama wajib diisi dari
**SKB 3 Menteri**, bukan dari ingatan atau kalender aplikasi.

Selama berkas itu masih placeholder, aturan `rawat-jalan-hari-libur` hanya
mendeteksi hari Minggu, dan UI menampilkan peringatan bahwa daftarnya belum
diisi. Cara mengisinya ada di dalam berkas itu sendiri.

---

## Menjalankan sendiri

Perlu Node.js 20 atau lebih baru.

```bash
npm install
npm run dev      # buka http://localhost:5173
```

Perintah lain:

```bash
npm test         # menjalankan seluruh test
npm run typecheck
npm run build    # hasilnya di dist/, berupa situs statis
npm run preview  # menyajikan hasil build
```

### Menyebarkan ke GitHub Pages

Hasil `npm run build` adalah situs statis biasa di folder `dist/`. Karena
`base` sudah disetel relatif, isinya bisa langsung disajikan dari sub-folder
mana pun — termasuk `https://<pengguna>.github.io/<repo>/` — tanpa perubahan
konfigurasi.

Catatan ukuran: mesin basis data DuckDB berbentuk WebAssembly berukuran sekitar
36 MB (±7 MB setelah gzip). Unduhan pertama besar; setelah ter-cache, aplikasi
berjalan tanpa jaringan.

---

## Struktur proyek

```
config/column-map.yaml   Pemetaan 93 kolom E-Klaim -> nama kolom baku.
                         Satu-satunya tempat nama kolom asli ditulis.
data/hari-libur/         Daftar hari libur per tahun (wajib diisi dari SKB).
docs/format-eklaim.md    Hasil verifikasi format berkas E-Klaim.
rules/<kategori>/*.yaml  Satu berkas = satu aturan audit.
src/parser/              Pembacaan berkas dan validasi relasi antar-kolom.
src/db/                  Pemuatan ke DuckDB-WASM.
src/rules/               Skema aturan, mesin eksekusi, dan ringkasan.
src/privasi/             Penyamaran kolom identitas.
src/ekspor/              Ekspor CSV dan Excel.
src/ui/                  Komponen antarmuka.
tests/                   217 test. Hanya memakai data sintetis.
```

Dokumen [`docs/format-eklaim.md`](docs/format-eklaim.md) berisi hasil
pembacaan format berkas E-Klaim: 93 kolom beserta tipenya, relasi antar-kolom
yang terbukti, cara menormalkan nilai kosong, dan daftar hal yang masih belum
pasti. Berguna juga di luar proyek ini.

---

## Ikut menyumbang

Yang paling dibutuhkan proyek ini **bukan** tambahan kode, melainkan:

- **aturan baru** dari koder dan tim casemix yang tahu kejanggalan apa yang
  sering muncul di lapangan;
- **sumber regulasi** untuk aturan yang masih berstatus draft;
- **koreksi** bila ada penjelasan yang keliru.

Menulis aturan baru tidak memerlukan kemampuan pemrograman. Caranya ada di
[CONTRIBUTING.md](CONTRIBUTING.md), lengkap dengan contoh dan berkas contekan
[`rules/_template.yaml`](rules/_template.yaml).

**Jangan pernah melampirkan berkas klaim asli** ke dalam laporan, isu, maupun
permintaan perubahan. Folder `samples/` sudah masuk `.gitignore` dan seluruh
test memakai data sintetis.

---

## Batasan yang perlu disadari

- Alat ini membaca **berkas ekspor**, bukan rekam medis. Ia tidak bisa tahu
  apakah dokumentasinya benar-benar ada — hanya bisa menunjukkan di mana perlu
  dicek.
- Format berkas diverifikasi terhadap ekspor E-Klaim versi 5.10.x dengan 93
  kolom. Berkas dari versi lain mungkin tidak terbaca; bila jumlah atau nama
  kolomnya berbeda, aplikasi akan memberi tahu dan tidak menebak-nebak.
- Satu berkas bisa memuat beberapa versi grouper sekaligus. Ini normal, tetapi
  aturan yang bergantung pada versi grouper perlu memperhitungkannya.
- Kolom `C3` pada berkas E-Klaim belum diketahui artinya dan sengaja diabaikan.
- Temuan yang nol **bukan** berarti klaim pasti benar. Aturan yang ada baru
  menutupi sebagian kecil kemungkinan masalah.

---

## Lisensi

- **Kode program**: [AGPL-3.0-or-later](LICENSE). Bila Anda memodifikasinya dan
  menyajikannya sebagai layanan daring, kode modifikasinya wajib tersedia bagi
  penggunanya.
- **Folder `rules/`**: [CC BY-SA 4.0](rules/LICENSE). Aturan audit adalah
  pengetahuan bersama, bebas dipakai dan diadaptasi selama atribusinya
  dicantumkan dan dibagikan dengan lisensi yang sama.

Dibangun dari nol berdasarkan regulasi publik dan pembacaan format berkas
ekspor. Tidak meniru produk komersial mana pun.
