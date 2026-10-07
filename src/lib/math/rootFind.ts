export interface RootOptions {
  tol?: number;
  maxIter?: number;
}

/** Bisection on [a, b]; f(a) and f(b) must have opposite signs. */
export function bisection(f: (x: number) => number, a: number, b: number, { tol = 1e-12, maxIter = 200 }: RootOptions = {}): number {
  let fa = f(a);
  const fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) throw new Error('bisection: root is not bracketed');
  let lo = a;
  let hi = b;
  for (let i = 0; i < maxIter; i++) {
    const mid = 0.5 * (lo + hi);
    const fm = f(mid);
    if (fm === 0 || 0.5 * (hi - lo) < tol) return mid;
    if (fa * fm < 0) {
      hi = mid;
    } else {
      lo = mid;
      fa = fm;
    }
  }
  return 0.5 * (lo + hi);
}

/** Newton–Raphson from x0. Returns NaN if it fails to converge. */
export function newton(f: (x: number) => number, df: (x: number) => number, x0: number, { tol = 1e-12, maxIter = 100 }: RootOptions = {}): number {
  let x = x0;
  for (let i = 0; i < maxIter; i++) {
    const fx = f(x);
    const dfx = df(x);
    if (dfx === 0 || !Number.isFinite(dfx)) return NaN;
    const step = fx / dfx;
    x -= step;
    if (Math.abs(step) < tol * Math.max(1, Math.abs(x))) return x;
  }
  return NaN;
}
