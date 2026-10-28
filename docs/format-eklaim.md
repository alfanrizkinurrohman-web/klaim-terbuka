# Format file ekspor E-Klaim (TXT)

Dokumen ini hasil verifikasi Fase 0 terhadap `samples/sampel_eklaim_anonim.txt`
(260 baris klaim, 93 kolom). Semua pernyataan di bawah ini **diverifikasi pada
sampel tersebut**, kecuali yang ditandai `BELUM PASTI`.

File sampel tidak ikut di-commit (lihat `.gitignore`).

---

## 1. Struktur berkas

| Properti | Nilai terverifikasi |
|---|---|
| Encoding | ASCII murni (tidak ada byte > 0x7F) |
| Pemisah kolom | TAB (`\t`) |
| Akhir baris | CRLF (`\r\n`), 261 CRLF, tidak ada bare LF/CR, berakhir dengan CRLF |
| Baris pertama | header nama kolom |
| Jumlah kolom | **93**, konsisten di semua baris (0 baris dengan jumlah field berbeda) |
| 1 baris | 1 klaim |
| Pola nama file asli | `<KODE_RS>_<YYYYMMDD>_<jenis>.TXT` |

Parser harus mentoleransi baris kosong di akhir berkas dan **tidak** mengasumsikan
file selalu berakhir CRLF.

## 2. Urutan kolom (1–93)

```
 1 KODE_RS              32 TARIF_SP             63 KONSULTASI
 2 KELAS_RS             33 DESKRIPSI_SR         64 TENAGA_AHLI
 3 KELAS_RAWAT          34 TARIF_SR             65 KEPERAWATAN
 4 KODE_TARIF           35 DESKRIPSI_SI         66 PENUNJANG
 5 PTD                  36 TARIF_SI             67 RADIOLOGI
 6 ADMISSION_DATE       37 DESKRIPSI_SD         68 LABORATORIUM
 7 DISCHARGE_DATE       38 TARIF_SD             69 PELAYANAN_DARAH
 8 BIRTH_DATE           39 TOTAL_TARIF          70 REHABILITASI
 9 BIRTH_WEIGHT         40 TARIF_RS             71 KAMAR_AKOMODASI
10 SEX                  41 TARIF_POLI_EKS       72 RAWAT_INTENSIF
11 DISCHARGE_STATUS     42 LOS                  73 OBAT
12 DIAGLIST             43 ICU_INDIKATOR        74 ALKES
13 PROCLIST             44 ICU_LOS              75 BMHP
14 ADL1                 45 VENT_HOUR            76 SEWA_ALAT
15 ADL2                 46 NAMA_PASIEN          77 OBAT_KRONIS
16 IN_SP                47 MRN                  78 OBAT_KEMO
17 IN_SR                48 UMUR_TAHUN           79 IDRG_DIAG_LISTS
18 IN_SI                49 UMUR_HARI            80 IDRG_PROC_LISTS
19 IN_SD                50 DPJP                 81 IDRG_MDC_NUMBER
20 INACBG               51 SEP                  82 IDRG_MDC_DESCRIPTION
21 SUBACUTE             52 NOKARTU              83 IDRG_DRG_CODE
22 CHRONIC              53 PAYOR_ID             84 IDRG_DRG_DESCRIPTION
23 SP                   54 CODER_ID             85 IDRG_COST_WEIGHT
24 SR                   55 VERSI_INACBG         86 IDRG_SA_COST_WEIGHT
25 SI                   56 VERSI_GROUPER        87 IDRG_CH_COST_WEIGHT
26 SD                   57 C1                   88 IDRG_TOP_UP
27 DESKRIPSI_INACBG     58 C2                   89 IDRG_TOTAL_COST_WEIGHT
28 TARIF_INACBG         59 C3                   90 IDRG_NBR
29 TARIF_SUBACUTE       60 C4                   91 IDRG_TOTAL_TARIF
30 TARIF_CHRONIC        61 PROSEDUR_NON_BEDAH   92 IDRG_GROUPER_VERSION
31 DESKRIPSI_SP         62 PROSEDUR_BEDAH       93 IDRG_LOGIC_VERSION
```

Pemetaan nama kolom → nama baku internal diletakkan di `config/column-map.yaml`,
**tidak** di-hardcode (Fase 1).

## 3. Normalisasi nilai

| Kasus | Penulisan di berkas | Normalisasi |
|---|---|---|
| Daftar kode | dipisah `;`, kode **pertama** = diagnosis/prosedur utama | array |
| `PROCLIST` kosong | `-` (80/260 baris) | `[]` |
| `IDRG_PROC_LISTS` kosong | `""` (80/260 baris) | `[]` |
| Special CMG kosong | `None` (kolom `SUBACUTE`, `CHRONIC`, `SP`, `SR`, `SI`, `SD`, `IN_SP`, `IN_SR`, `IN_SI`, `IN_SD`) | `NULL` |
| Deskripsi kosong | `-` (kolom `DESKRIPSI_SP/SR/SI/SD`, `ADL1`, `ADL2`) | `NULL` |
| Kolom IDRG kosong | `""` (`IDRG_SA_COST_WEIGHT`, `IDRG_CH_COST_WEIGHT`, `IDRG_TOP_UP` — kosong di **seluruh** sampel) | `NULL` |
| Tanggal | `DD/MM/YYYY` (260/260 terparse di ketiga kolom tanggal) | `DATE` |
| Tarif | integer rupiah, tanpa pemisah ribuan — terverifikasi di seluruh kolom `TARIF_*`, `TOTAL_TARIF`, dan 18 komponen | `BIGINT` |
| `PAYOR_ID` | **majemuk**: `3;JKN` (kode `;` nama) | pisah jadi `payor_kode` + `payor_nama` |
| `CODER_ID` | **majemuk**: `KODER-99;9999999999999999;KODER-99` (3 segmen dipisah `;`), atau string kosong (29/260) | simpan mentah + segmen ke-1 sebagai id koder |

`IDRG_COST_WEIGHT` dan `IDRG_TOTAL_COST_WEIGHT` adalah desimal 2 angka, bukan
integer.

## 4. Relasi yang diuji

| Relasi | Hasil pada sampel |
|---|---|
| `PTD` ∈ {1 = ranap, 2 = rajal} | ✅ 154 ranap, 106 rajal, tidak ada nilai lain |
| `LOS = (DISCHARGE_DATE − ADMISSION_DATE) + 1` | ✅ **0 pelanggaran** / 260 |
| `TARIF_RS = Σ 18 komponen` | ✅ **0 pelanggaran** / 260 |
| `TOTAL_TARIF = TARIF_INACBG + SUBACUTE + CHRONIC + SP + SR + SI + SD` | ✅ **0 pelanggaran** / 260 |
| `IDRG_TOTAL_TARIF ≈ IDRG_TOTAL_COST_WEIGHT × IDRG_NBR` | ⚠️ lihat §4.1 |
| Format `INACBG` = `CMG-tipe-spesifik-severity` | ✅ 260/260 cocok regex `^[A-Z]-\d-\d\d-(0\|I\|II\|III)$` |
| `DISCHARGE_DATE ≥ ADMISSION_DATE` | ✅ 0 pelanggaran |
| `UMUR_HARI = ADMISSION_DATE − BIRTH_DATE` | ✅ 0 pelanggaran |
| Rajal (`PTD=2`): `ADMISSION_DATE = DISCHARGE_DATE` dan `LOS = 1` | ✅ 106/106 |

### 4.1 Toleransi relasi IDRG — **koreksi terhadap spesifikasi awal**

Dengan toleransi ±Rp1 relasi hanya cocok **212/260 (81,5 %)**, bukan ~98 %.
Penyebabnya bukan pembulatan rupiah melainkan pembulatan *cost weight*:
`IDRG_TOTAL_COST_WEIGHT` disimpan dengan **2 angka desimal**, sedangkan
`IDRG_TOTAL_TARIF` dihitung dari cost weight yang belum dibulatkan.

Simpangan maksimum pada *cost weight* tersirat (`IDRG_TOTAL_TARIF / IDRG_NBR`)
terhadap nilai tertulis adalah **0,004746** — tepat di bawah setengah satuan
desimal terakhir (0,005).

→ **Toleransi yang benar: `|IDRG_TOTAL_TARIF − tcw × NBR| ≤ 0,005 × IDRG_NBR + 0,5`.**
Dengan toleransi ini sampel cocok **260/260 (100 %)**. Inilah yang dipakai
validator parser.

Tambahan `+ 0,5` menutup pembulatan kedua: `IDRG_TOTAL_TARIF` berupa rupiah
bulat. Tanpa itu, *cost weight* yang nilainya tepat di tengah (mis. 2,555,
dibulatkan ke atas menjadi 2,56) menghasilkan selisih sedikit di atas batas
dan dilaporkan sebagai pelanggaran palsu. Kasus ini tidak muncul di sampel,
tetapi muncul pada data sintetis Fase 1.

`IDRG_NBR` konstan per jenis rawat:

| PTD | IDRG_NBR |
|---|---|
| 1 (ranap) | 8.037.060 |
| 2 (rajal) | 461.474 |

### 4.2 Segmen ke-2 kode INA-CBG — konfirmasi bahwa aturan genap/ganjil **salah**

Distribusi segmen ke-2 terhadap `PTD` pada sampel:

| Segmen 2 | PTD=1 (ranap) | PTD=2 (rajal) |
|---|---|---|
| 1 | 41 | 0 |
| 2 | 0 | 11 |
| 3 | 0 | 27 |
| 4 | 91 | 0 |
| 5 | 0 | 60 |
| 6 | 22 | 0 |
| 7 | 0 | 8 |

Jadi ranap = {1, 4, 6} dan rajal = {2, 3, 5, 7} — **bukan** genap/ganjil.
Sesuai instruksi: **jenis rawat selalu ditentukan dari `PTD`**, tidak pernah dari
kode INA-CBG.

Distribusi severity (segmen ke-4): `0` = 106, `I` = 77, `II` = 57, `III` = 20.
Seluruh 106 klaim severity `0` adalah rajal — severity `0` dan `PTD=2` berimpit
sempurna pada sampel ini.

## 5. Kolom C1–C4

| Kolom | Temuan | Perlakuan |
|---|---|---|
| `C1` | ID urut, 260 nilai unik (`100001`…) | abaikan |
| `C3` | nilai `1`–`6` pada sampel (spesifikasi menyebut 1–8) | **abaikan**, arti belum diketahui — lihat pertanyaan terbuka |
| `C4` | 32 karakter heksadesimal, 260/260 | abaikan |
| `C2` | 14 sub-field dipisah `#`, 260/260 baris | lihat §5.1 |

### 5.1 `C2` — **indeks sub-field bergeser +1 dari spesifikasi awal**

Spesifikasi awal menomori sub-field mulai dari 0. Pada berkas, setelah `split("#")`,
indeks **1-based**-nya adalah sebagai berikut:

| Posisi (1-based) | Isi teramati | Padanan di spesifikasi awal |
|---|---|---|
| 1 | selalu `1` | — (tidak disebut) |
| 2 | flag naik kelas `0`/`1` | "sub-field 1" |
| 3 | kelas tujuan: `""`, `kelas_1`, `vip` | "sub-field 2" |
| 4 | `0`,`2`,`3`,`4`,`5`,`6` — `BELUM PASTI` | — |
| 5 | = `selisih_biaya.nilai` pada JSON (cocok 260/260) | — |
| 6 | desimal, 251× bernilai `0.0`; sisanya 0,2–75,0 — `BELUM PASTI` | — |
| 7 | timestamp `YYYY-MM-DD HH:MM:SS` | "sub-field 6" |
| 8 | selalu `0` | — |
| 9 | jam `HH:MM:SS` — `BELUM PASTI` | — |
| 10 | jam `HH:MM:SS` — `BELUM PASTI` | — |
| 11 | selalu `00:00:00` | — |
| 12 | **kosong di seluruh sampel** | — |
| 13 | **kosong di seluruh sampel** — posisi JSON registri TB | "sub-field 12" |
| 14 | **JSON data klinis** | "sub-field 13" |

Jadi semua acuan di spesifikasi awal benar, hanya berbasis 0. Parser memakai
konstanta bernama, bukan angka telanjang, agar tidak ada ambiguitas.

**Privasi:** sub-field ke-13 (posisi 1-based) adalah tempat respons registri TB
yang berisi nama dan NIK. Pada sampel anonim ini kosong, tetapi pada berkas asli
tidak. **Parser membuang sub-field 12 dan 13 sebelum pemrosesan apa pun** dan
tidak pernah mem-parse, menyimpan, atau menampilkannya.

Konsistensi `C2` yang terverifikasi:
- sub-field 2 `1` ⟺ sub-field 3 ∈ {`kelas_1`, `vip`} (22 baris), `0` ⟺ `""` (238 baris).
- sub-field 3 = `selisih_biaya.naik_kelas` di JSON, 260/260.
- sub-field 7 (timestamp) selalu ≥ `DISCHARGE_DATE`, selisih 0–11 hari → tampak
  sebagai waktu *grouping/finalisasi klaim*, bukan waktu pelayanan. `BELUM PASTI`.

### 5.2 JSON pada `C2` sub-field 14

Parse berhasil 260/260. Kunci tingkat atas yang ditemukan — seluruh kunci yang
disebut di spesifikasi awal **ada**, ditambah satu yang belum disebut:

```
cara_masuk, sistole, diastole, total_tarif_rs (BARU), billing_group,
selisih_biaya, ventilator, dializer_single_use, alteplase_ind, kantong_darah,
apgar_score, persalinan, episode_ruangan, obat, dpjp, idrg
```

- `cara_masuk`: `gp` 160, `emd` 99, `outp` 1. (`inp`/`mp` tidak muncul di sampel.)
- `billing_group`: 18 kunci yang **identik isinya** dengan 18 kolom komponen tarif
  (0 selisih pada 260 baris), begitu pula `total_tarif_rs` = `TARIF_RS`.
- `persalinan`: non-null pada 28 baris, seluruhnya `SEX=2`. Kunci:
  `usia_kehamilan`, `gravida`, `partus`, `abortus`, `onset_kontraksi`, `delivery`
  (array; kosong pada contoh yang diperiksa).
- `episode_ruangan` dan `obat`: array kosong di seluruh sampel.
- `ventilator.use_ind`: `1` pada 7 baris — **cocok sempurna** dengan `VENT_HOUR > 0`
  (7 baris). Nilai `0` (42×) dan `""` (211×) keduanya berarti tidak dipakai.
- `idrg`: menduplikasi kolom `IDRG_*` — cocok 254/260; lihat §5.3.

Parsing JSON **harus toleran**: `try`/`catch` per baris, baris gagal menjadi
peringatan parser, bukan crash.

### 5.3 Snapshot `C2.idrg` bisa basi

Pada 6 baris, `C2.idrg.total_cost_weight` dan `.total_tarif` lebih rendah daripada
kolom `IDRG_TOTAL_COST_WEIGHT` / `IDRG_TOTAL_TARIF`; pada keenam baris nilai di
JSON justru sama dengan `IDRG_COST_WEIGHT` (sebelum top-up).

→ **Kolom `IDRG_*` adalah sumber kebenaran.** JSON di `C2` hanya dipakai untuk
kolom yang tidak punya padanan kolom (mis. `cara_masuk`, tekanan darah, persalinan).

## 6. Kolom kelompok — nilai pada sampel

| Kolom | Nilai |
|---|---|
| `KODE_RS` | `0000000` (dianonimkan) |
| `KELAS_RS` | `C` |
| `KELAS_RAWAT` | `3` (205), `2` (28), `1` (27) |
| `KODE_TARIF` | `CS` |
| `SEX` | `2` (144), `1` (116) |
| `DISCHARGE_STATUS` | `1` (211), `4` (28), `5` (12), `3` (5), `2` (4) |
| `ICU_INDIKATOR` | `0` (239), `1` (21) |
| `PAYOR_ID` | `3;JKN` |
| `VERSI_INACBG` | **3 versi dalam satu berkas**: `5.10.8.202606251251` (205), `5.10.7.202603311031` (31), `5.10.9.202609291001` (24) |
| `VERSI_GROUPER` | `4` |
| `IDRG_GROUPER_VERSION` / `IDRG_LOGIC_VERSION` | beberapa versi, sejalan dengan `VERSI_INACBG` |
| `BIRTH_WEIGHT` | `0` di seluruh sampel |
| `UMUR_TAHUN` | 0–93 |
| `UMUR_HARI` | 76–33.977 |
| `ICU_LOS` | 0–8 |
| `VENT_HOUR` | 0–165 |
| `LOS` | 1–14 |

Satu berkas memang dapat memuat beberapa versi grouper — terkonfirmasi. Setiap
aturan yang bergantung pada versi grouper wajib memfilter berdasarkan
`VERSI_INACBG`.

Kolom yang **konstan di seluruh sampel** (jangan disimpulkan selalu konstan di
berkas lain): `ADL1`, `ADL2`, `TARIF_POLI_EKS`, `TARIF_SUBACUTE`, `TARIF_CHRONIC`,
`SUBACUTE`, `CHRONIC`, `SR`, `SI`, `TARIF_SR`, `TARIF_SI`, `REHABILITASI`,
`RAWAT_INTENSIF`, `ALKES`, `OBAT_KRONIS`, `OBAT_KEMO`, `IDRG_SA_COST_WEIGHT`,
`IDRG_CH_COST_WEIGHT`, `IDRG_TOP_UP`.

## 7. Kolom identitas

Wajib di-mask di UI dan tidak pernah diekspor tanpa izin eksplisit:

`NAMA_PASIEN`, `MRN`, `SEP`, `NOKARTU`, `BIRTH_DATE`, `DPJP`, `CODER_ID`

Ditambah, karena memuat identitas langsung: **`C2` sub-field 12 dan 13 dibuang
saat parsing** (§5.1).

`MRN` dipakai sebagai kunci pasien untuk analisis readmisi. Pada sampel: 242 `MRN`
unik untuk 260 baris, `SEP` unik 260/260, `DPJP` 43 nilai unik.

## 8. Rentang data sampel

- Masuk: 2026-05-27 … 2026-08-31
- Pulang: 2026-06-01 … 2026-08-31

---

## 9. Pertanyaan terbuka (butuh keputusan dokter/koder)

1. **`C3`** — nilai 1–6 pada sampel. Tidak berkorelasi bersih dengan `PTD`,
   `DISCHARGE_STATUS`, `KELAS_RAWAT`, maupun `cara_masuk`. Tetap diabaikan.
2. **Selisih `IDRG_TOTAL_COST_WEIGHT` − `IDRG_COST_WEIGHT`** — positif pada 48
   baris (0,02–0,08), seluruhnya ranap, padahal kolom `IDRG_SA_COST_WEIGHT`,
   `IDRG_CH_COST_WEIGHT`, dan `IDRG_TOP_UP` **kosong di seluruh sampel**.
   Komponen penambahnya tidak terlihat di berkas.
3. **`C2` sub-field 4, 6, 9, 10** — belum teridentifikasi, disimpan mentah.
4. **`RAWAT_INTENSIF` = 0 di seluruh sampel** sementara `ICU_INDIKATOR = 1` pada
   21 baris (dan `ICU_LOS > 0` pada sebagian). Aturan Fase 2 nomor 4 akan memicu
   pada 21 dari 21 kasus ICU. Perlu dipastikan apakah biaya ICU memang dibukukan
   di komponen lain (`KAMAR_AKOMODASI`) di RS ini.
5. **Toleransi IDRG** (§4.1) diubah dari ±Rp1 menjadi ±0,005 × `IDRG_NBR`.
