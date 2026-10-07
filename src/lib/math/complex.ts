/** Minimal complex arithmetic for characteristic functions (Chapters 30, 31, 35). */
export interface Complex {
  re: number;
  im: number;
}

export const c = (re: number, im = 0): Complex => ({ re, im });
export const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const sub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
export const mul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const scale = (a: Complex, k: number): Complex => ({ re: a.re * k, im: a.im * k });

export function div(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}

export function exp(a: Complex): Complex {
  const m = Math.exp(a.re);
  return { re: m * Math.cos(a.im), im: m * Math.sin(a.im) };
}

/** Principal logarithm. */
export function log(a: Complex): Complex {
  return { re: Math.log(Math.hypot(a.re, a.im)), im: Math.atan2(a.im, a.re) };
}

/** Principal square root. */
export function sqrt(a: Complex): Complex {
  const r = Math.hypot(a.re, a.im);
  const re = Math.sqrt((r + a.re) / 2);
  const im = Math.sign(a.im || 1) * Math.sqrt(Math.max((r - a.re) / 2, 0));
  return { re, im };
}

export const abs = (a: Complex) => Math.hypot(a.re, a.im);
