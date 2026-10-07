import { Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { estimateHurst, fbmPath } from '../../lib/math/fbm';
import { Button, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { extent, niceTicks } from './format';
import { Label, PlotFrame } from './PlotFrame';

const N = 400;
const ETA = 0.9; // volatility of log-volatility

/**
 * Chapter 32: fractional Brownian motion for a chosen Hurst exponent H (top,
 * with the H = ½ Brownian path from the same random numbers in grey), and the
 * volatility path σ_t = σ₀ exp(ηB_H(t) − ½η²t^{2H}) it drives (bottom).
 */
export default function RoughPaths() {
  const [H, setH] = useState(0.1);
  const [seed, setSeed] = useState(2);
  const path = useMemo(() => fbmPath(seed, H, N), [seed, H]);
  const brownian = useMemo(() => fbmPath(seed, 0.5, N), [seed]);
  const t = (i: number) => i / N;
  const vol = path.map((b, i) => 0.2 * Math.exp(ETA * b - 0.5 * ETA * ETA * t(i) ** (2 * H)));
  const [lo, hi] = extent([...path, ...brownian]);
  const vMax = Math.max(...vol) * 1.1;
  const est = estimateHurst(path);

  const top = (
    <PlotFrame x={[0, 1]} y={[lo - 0.1, hi + 0.1]} height={170} xTicks={[0, 0.25, 0.5, 0.75, 1]} yTicks={niceTicks(lo - 0.1, hi + 0.1, 4)} formatX={(v) => `t = ${v}`} formatY={(v) => v.toFixed(1)} baseline={0} yLabel="fractional Brownian motion">
      <Polyline points={brownian.map((b, i) => [t(i), b] as [number, number])} color="var(--text-muted)" weight={1} strokeOpacity={0.6} fillOpacity={0} />
      <Polyline points={path.map((b, i) => [t(i), b] as [number, number])} color="var(--c-spot)" weight={1.5} fillOpacity={0} />
      <Label x={1} y={brownian[N]} attach="w" attachDistance={6} size={11} color="var(--text-muted)">H = ½</Label>
    </PlotFrame>
  );
  const bottom = (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <PlotFrame x={[0, 1]} y={[0, vMax]} height={160} xTicks={[0, 0.25, 0.5, 0.75, 1]} yTicks={niceTicks(0, vMax, 4)} formatX={(v) => `t = ${v}`} formatY={(v) => `${Math.round(v * 100)}%`} yLabel="volatility it drives">
        <Polyline points={vol.map((v, i) => [t(i), v] as [number, number])} color="var(--c-vol)" weight={1.5} fillOpacity={0} />
      </PlotFrame>
    </div>
  );

  return (
    <WidgetFrame
      title="Rough paths"
      ariaLabel={`Fractional Brownian motion with Hurst exponent ${H.toFixed(2)}; the path's estimated roughness is H ≈ ${est.toFixed(2)}.`}
      plotHeight={330}
      plot={<>{top}{bottom}</>}
      controls={
        <>
          <Slider label="Hurst exponent H" value={H} min={0.05} max={0.95} step={0.05} onChange={setH} format={(v) => v.toFixed(2)} color="var(--c-spot)" />
          <Button onClick={() => setSeed((s) => s + 1)}>New path</Button>
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Character</dt><dd>{H < 0.45 ? 'rough: increments tend to reverse' : H > 0.55 ? 'smooth: increments tend to persist' : 'Brownian: independent increments'}</dd>
          <dt>H estimated from this path</dt><dd>{est.toFixed(2)} <span className="muted">(from how fast squared increments grow with the lag)</span></dd>
        </dl>
      }
      caption="Top: fractional Brownian motion with your H (blue) and ordinary Brownian motion from the same random numbers (grey). Bottom: a rough volatility path, $\sigma_t = \sigma_0 \exp(\eta B^H_t - \tfrac12\eta^2 t^{2H})$, with $\sigma_0 = 20\%$ and $\eta = 0.9$."
    />
  );
}
