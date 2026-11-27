# Diskusi & Rencana Fitur: Pembagian Klaster Jalur Leluhur (Trah / Bani) & Multi-User

**Tanggal Diskusi:** 27 November 2026  
**Status:** Tahap Diskusi & Perancangan Konsep (Belum Dieksekusi ke Kode)

---

## 1. Latar Belakang & Masalah Utama

1. **Kebutuhan Awal:**
   - Ingin membagi anggota keluarga ke dalam **4 klaster jalur leluhur** berdasarkan titik tengah (*Center / Ego*):
     1. **Bapaknya Ayah** (*Paternal Grandfather*)
     2. **Ibunya Ayah** (*Paternal Grandmother*)
     3. **Bapaknya Ibu** (*Maternal Grandfather*)
     4. **Ibunya Ibu** (*Maternal Grandmother*)
2. **Masalah di Pencarian & Daftar Anggota Saat Data Makin Banyak:**
   - Ketika ada data baru masuk dari jalur keluarga tertentu (misal dari keluarga besar Bapaknya Ayah), daftar anggota di halaman **Anggota Keluarga** (`PeoplePage.tsx`) maupun di dropdown pencarian (`PersonPicker.tsx`) **bercampur menjadi satu list besar**.
   - Jika ada nama yang mirip atau sama dari jalur yang berbeda, pengguna kesulitan membedakan orang tersebut berasal dari jalur keluarga yang mana karena belum ada **label/badge klaster jalur** pada tiap item hasil pencarian.
3. **Masalah Irisan Keturunan di Kode Saat Ini (`src/lib/lineageScope.ts`):**
   - Di kode saat ini sudah ada fungsi `detectFourGrandparentLines(homePersonId, persons, relationships)` dan komponen `LineageScopeSelector.tsx`.
   - Namun, saat memfilter berdasarkan salah satu kakek/nenek dengan arah `'both'` (Atas & Bawah), keturunan di bawah pernikahan Kakek & Nenek (seperti Ayah/Ibu, Pakde/Bude/Om/Tante, serta diri sendiri) ikut masuk ke kedua jalur (Kakek sekaligus Nenek).
   - Sebaliknya, jika ada **keluarga besar dari kakak/adik kandung Kakek atau Nenek** (keturunan dari Buyut), mereka perlu ditarik melalui leluhur di atas Kakek/Nenek agar masuk ke klaster keluarga besar Kakek vs klaster keluarga besar Nenek secara terpisah.

---

## 2. Tantangan Multi-User (Mengapa Istilah "Bapaknya Ayah" Membingungkan?)

Jika aplikasi digunakan oleh **banyak user (Multi-User)** — misalnya dibuka oleh Ayah, Anak, Sepupu dari pihak Ibu, atau Koordinator Cabang:
- Istilah *"Jalur Bapaknya Ayah"* bersifat **relatif (ego-sentris)** terhadap satu orang saja.
- Bagi user A, tokoh Mbah Ahmad adalah *"Bapaknya Ayah (Kakek)"*.
- Bagi ayah user A, Mbah Ahmad adalah *"Ayah"*.
- Bagi anak user A, Mbah Ahmad adalah *"Buyut"*.
- Bagi sepupu dari jalur Ibu, Mbah Ahmad **bukan leluhurnya sama sekali**.

Jika label klaster ditulis mati sebagai *"Jalur Bapaknya Ayah"*, maka user lain yang melihat daftar pencarian akan bingung.

---

## 3. Solusi & Arsitektur yang Disepakati untuk Multi-User

Gunakan pendekatan **Hybrid: Nama Klaster Absolut (Berbasis Nama Leluhur / Trah) + Konteks Relatif Personal (Opsional per User)**.

### A. Klaster Absolut Berbasis "Nama Trah / Bani Leluhur" (Konsisten untuk Semua User)
Alih-alih menamai klaster dengan hubungan relatif, klaster dinamai menggunakan **Nama Tokoh Leluhur Induknya**:
- 🔵 **Trah / Bani [Nama Kakek Ayah / Leluhur 1]**
- 🟢 **Trah / Bani [Nama Nenek Ayah / Leluhur 2]**
- 🟡 **Trah / Bani [Nama Kakek Ibu / Leluhur 3]**
- 🟣 **Trah / Bani [Nama Nenek Ibu / Leluhur 4]**

**Keunggulan:**
- Objektif dan konsisten bagi siapa pun yang membuka aplikasi (baik admin, sepupu, orang tua, maupun generasi cucu).
- Setiap anggota baru yang masuk dan terhubung ke pohon silsilah otomatis terdeteksi masuk ke Trah/Klaster mana berdasarkan garis darah leluhurnya.

### B. Konteks Relatif Personal (Berdasarkan `homePersonId` / "Siapa Saya")
Karena tiap perangkat/user bisa menentukan **"Jadikan Saya" (`homePersonId`)**:
- Label utama badge tetap menampilkan nama objektif: **`🔵 Trah Mbah Ahmad`**.
- Di bawahnya (atau sebagai keterangan pendamping), sistem menampilkan hubungan relatif terhadap user yang sedang aktif melihat:
  - Jika yang melihat adalah **Saya**: `🔵 Trah Mbah Ahmad (Jalur Kakek · Ayah)`
  - Jika yang melihat adalah **Anak Saya**: `🔵 Trah Mbah Ahmad (Jalur Buyut)`
  - Jika user belum memilih "Siapa Saya": cukup tampil `🔵 Trah Mbah Ahmad`.

### C. Penerapan Visual di Pencarian & Daftar Anggota
1. **Badge Trah/Klaster di Hasil Pencarian (`PeoplePage.tsx` & `PersonPicker.tsx`):**
   - Setiap kartu anggota, baris tabel, dan item dropdown pencarian menampilkan badge warna klaster/trah-nya (misal: `[🔵 Trah Mbah Ahmad]`) beserta info orang tua/pasangannya (`Anak dari ...`).
   - Dengan begitu, saat mencari nama di list, data tidak lagi membingungkan meskipun namanya mirip.
2. **Chip / Tab Filter Cepat Klaster di Halaman Pencarian:**
   - Di atas daftar anggota, pengguna bisa langsung mengklik chip klaster (misal: `Semua`, `🔵 Trah A`, `🟢 Trah B`, `🟡 Trah C`, `🟣 Trah D`) untuk menyaring daftar pencarian hanya pada klaster tersebut.
3. **Penentuan Induk Klaster (Root Trah):**
   - Bisa diambil otomatis dari 4 jalur kakek-nenek milik tokoh acuan utama / cabang (`branches`), atau dari tokoh-tokoh leluhur yang di-pin (`pinnedLineageIds`) sebagai Induk Trah.

---

## 4. Cara Melanjutkan Diskusi di Device Lain

Saat membuka project ini di perangkat (laptop/PC) lain:
1. Lakukan `git pull` untuk menarik file `docs/DISKUSI_KLASTER_TRAH.md` ini.
2. Buka chat Antigravity baru, lalu kirimkan pesan:
   > *"Tolong baca file `docs/DISKUSI_KLASTER_TRAH.md`. Kita lanjutkan diskusi atau implementasi fitur pembagian klaster trah dari catatan tersebut."*
