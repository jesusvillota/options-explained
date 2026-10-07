/** Number formatting shared by widgets. */
export const money = (v: number, digits = 2) =>
  `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const signedMoney = (v: number, digits = 2) => {
  const rounded = Number(v.toFixed(digits));
  if (rounded === 0) return money(0, digits);
  return `${rounded > 0 ? '+' : '−'}${money(v, digits)}`;
};
export const percent = (v: number, digits = 0) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v * 100).toFixed(digits)}%`;
export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
export const count = (v: number) => Math.round(v).toLocaleString('en-US');

/** Round tick marks covering [lo, hi]: steps of 1, 2 or 5 × 10ⁿ, about `target` of them. */
export function niceTicks(lo: number, hi: number, target = 5): number[] {
  const raw = (hi - lo) / Math.max(target, 1);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return ticks;
}
