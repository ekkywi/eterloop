import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format harga untuk display dengan jumlah desimal yang adaptif
 * berdasarkan magnitude harga, agar token kecil (e.g. SHIB 0.00000422)
 * tidak tampil sebagai "0.00".
 *
 * Aturan:
 *   -  >= 1000    → 0 desimal (e.g. 42,000)
 *   -  >= 1       → 2 desimal (e.g. 12.34)
 *   -  >= 0.01    → 4 desimal (e.g. 0.0523)
 *   -  >= 0.0001  → 6 desimal (e.g. 0.000423)
 *   -  < 0.0001   → gunakan toSignificantDigits (notasi presisi) untuk harga ekstrim
 */
export function formatPrice(price: number): string {
  const absPrice = Math.abs(price);

  if (absPrice >= 1000) {
    // Harga besar (misal BTC) — tanpa desimal, pakai grouping ribuan
    return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  if (absPrice >= 1) {
    // Harga menengah — 2 desimal
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  if (absPrice >= 0.01) {
    // Harga kecil — 4 desimal
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }

  if (absPrice >= 0.0001) {
    // Harga sangat kecil — 6 desimal
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }

  // Harga ekstrim (e.g. SHIB-level) — tampilkan semua significant digits
  // Contoh: 0.00000422 tetap ditampilkan sebagai "0.00000422"
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 12 });
}

/**
 * Format persentase dengan 2 desimal + tanda opsional.
 */
export function formatPct(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}
