/**
 * Pemicu unduhan berkas di peramban.
 *
 * Berkas dibuat dari data di memori lewat Blob dan URL objek lokal (blob:),
 * lalu diunduh langsung oleh peramban. Tidak ada unggahan dan tidak ada
 * perantara jaringan.
 */

export function unduhBytes(nama: string, bytes: Uint8Array, tipeMime: string): void {
  // Salin ke ArrayBuffer baru agar tipe Blob pasti cocok di semua peramban.
  const salinan = new Uint8Array(bytes.byteLength);
  salinan.set(bytes);
  const blob = new Blob([salinan.buffer], { type: tipeMime });
  const url = URL.createObjectURL(blob);
  try {
    const tautan = document.createElement('a');
    tautan.href = url;
    tautan.download = nama;
    tautan.rel = 'noopener';
    document.body.appendChild(tautan);
    tautan.click();
    tautan.remove();
  } finally {
    // Beri peramban waktu memulai unduhan sebelum URL dicabut.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** Nama berkas yang aman di Windows, macOS, dan Linux. */
export function namaBerkasAman(nama: string): string {
  return nama
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

/** Cap waktu untuk nama berkas, mis. 20261029-1130. */
export function capWaktu(sekarang = new Date()): string {
  const dua = (n: number): string => String(n).padStart(2, '0');
  return (
    `${sekarang.getFullYear()}${dua(sekarang.getMonth() + 1)}${dua(sekarang.getDate())}` +
    `-${dua(sekarang.getHours())}${dua(sekarang.getMinutes())}`
  );
}
