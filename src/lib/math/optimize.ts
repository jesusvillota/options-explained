/**
 * Nelder–Mead simplex minimisation (no derivatives needed). Used to calibrate
 * smile models to quotes (Chapter 32).
 */
export function nelderMead(f: (x: number[]) => number, x0: number[], { step = 0.1, tol = 1e-10, maxIter = 2000 } = {}): { x: number[]; fx: number; iterations: number } {
  const n = x0.length;
  let simplex = [x0, ...x0.map((_, i) => x0.map((v, j) => (i === j ? v + (v === 0 ? step : step * Math.abs(v)) : v)))];
  let values = simplex.map(f);
  let it = 0;
  for (; it < maxIter; it++) {
    const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
    simplex = order.map((i) => simplex[i]);
    values = order.map((i) => values[i]);
    if (Math.abs(values[n] - values[0]) < tol * (Math.abs(values[0]) + tol)) break;
    const centroid = x0.map((_, j) => simplex.slice(0, n).reduce((a, p) => a + p[j], 0) / n);
    const along = (t: number) => centroid.map((c, j) => c + t * (simplex[n][j] - c));
    const xr = along(-1), fr = f(xr);
    if (fr < values[0]) {
      const xe = along(-2), fe = f(xe);
      [simplex[n], values[n]] = fe < fr ? [xe, fe] : [xr, fr];
    } else if (fr < values[n - 1]) {
      [simplex[n], values[n]] = [xr, fr];
    } else {
      const xc = fr < values[n] ? along(-0.5) : along(0.5);
      const fc = f(xc);
      if (fc < Math.min(fr, values[n])) {
        [simplex[n], values[n]] = [xc, fc];
      } else {
        // Shrink towards the best point.
        simplex = simplex.map((p, i) => (i === 0 ? p : p.map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j]))));
        values = simplex.map((p, i) => (i === 0 ? values[0] : f(p)));
      }
    }
  }
  const best = values.indexOf(Math.min(...values));
  return { x: simplex[best], fx: values[best], iterations: it };
}
