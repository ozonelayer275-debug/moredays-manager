/** Format kobo integer to ₦ display string e.g. 150000 → ₦1,500.00 */
export function formatNaira(kobo: number): string {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Convert naira string input to kobo integer */
export function nairaToKobo(naira: number | string): number {
  return Math.round(Number(naira) * 100)
}

/** Convert kobo to naira number for display inputs */
export function koboToNaira(kobo: number): number {
  return kobo / 100
}
