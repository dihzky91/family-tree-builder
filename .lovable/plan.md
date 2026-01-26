
# Menambahkan Tanggal Lengkap di Main Chart

## Kondisi Saat Ini
Chart sudah menampilkan informasi tanggal, tapi hanya tahun saja:
- Lahir: `* 1990`
- Wafat: `† 2020`

## Perubahan yang Akan Dilakukan
Menampilkan tanggal dalam format yang lebih lengkap dan mudah dibaca:
- Lahir: `* 15 Jan 1990`
- Wafat: `† 20 Des 2020`

## Detail Implementasi

### 1. Modifikasi FamilyMainView.tsx
Menambahkan fungsi format tanggal menggunakan library `date-fns` (yang sudah ter-install) untuk menampilkan tanggal dalam format Indonesia yang ringkas.

```tsx
// Sebelum (hanya tahun)
const getYear = (dateStr?: string) =>
    dateStr ? dateStr.slice(0, 4) : null

// Sesudah (tanggal lengkap)
import { format, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'

const formatDate = (dateStr?: string) => {
    if (!dateStr) return null
    try {
        return format(parseISO(dateStr), 'd MMM yyyy', { locale: id })
    } catch {
        return dateStr.slice(0, 4) // fallback ke tahun saja
    }
}
```

### 2. Update Template Card HTML
Menggunakan fungsi `formatDate` untuk menampilkan tanggal lengkap:

```tsx
const birthDate = formatDate(d.data.birthday)  // "15 Jan 1990"
const deathDate = formatDate(d.data.deathday)  // "20 Des 2020"

let dateHtml = ''
if (birthDate) {
    dateHtml += `<span>* ${birthDate}</span>`
}
if (deathDate) {
    dateHtml += ` <span class="deceased">† ${deathDate}</span>`
}
```

### 3. Penyesuaian CSS (Opsional)
Memperlebar card sedikit untuk mengakomodasi tanggal yang lebih panjang:

```css
.f3-card {
  min-width: 200px; /* sebelumnya 180px */
}

.f3-meta {
  font-size: 11px; /* sedikit lebih kecil */
  white-space: nowrap;
}
```

## Hasil Akhir
| Sebelum | Sesudah |
|---------|---------|
| * 1990 | * 15 Jan 1990 |
| † 2020 | † 20 Des 2020 |

## File yang Diubah
1. `src/features/chart/views/FamilyMainView.tsx` - Format tanggal lengkap
2. `src/features/chart/views/family-chart.css` - Penyesuaian lebar card

## Catatan
- Menggunakan locale Indonesia (`id`) untuk format bulan dalam bahasa Indonesia
- Fallback ke tahun saja jika parsing tanggal gagal
- Format ringkas (d MMM yyyy) agar tidak terlalu panjang
