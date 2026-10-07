/** Number formatting shared by widgets. */
export const money = (v: number, digits = 2) => `$${Math.abs(v).toFixed(digits)}`;
export const signedMoney = (v: number, digits = 2) => {
  const rounded = Number(v.toFixed(digits));
  if (rounded === 0) return money(0, digits);
  return `${rounded > 0 ? '+' : '−'}${money(v, digits)}`;
};
export const percent = (v: number, digits = 0) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v * 100).toFixed(digits)}%`;
export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
