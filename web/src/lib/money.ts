/** Cent-precision sum, the same rounding as the backend's round(x, 2). Used only to add API subtotals. */
export const round2 = (n: number) => Math.round(n * 100) / 100
