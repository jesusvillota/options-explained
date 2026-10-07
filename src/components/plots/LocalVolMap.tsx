import { useMemo, useState } from 'react';
import { localVolPath, ssviLocalVol } from '../../lib/models/localVol';
import { EQUITY_SSVI, ssviVol, type SSVIParams } from '../../lib/vol/smile';
import { Button, Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { Heatmap } from './Heatmap';

type View = 'local' | 'implied';
const S0 = 100, r = 0.05;
const HEIGHT = 320;
const PATHS = 8;
const pct = (v: number) => `${v < -0.0005 ? '−' : ''}${Math.abs(v * 100).toFixed(1)}%`;

/**
 * Chapter 29: Dupire's local volatility σ_loc(S, t) for an SSVI implied surface,
 * as a colour map over stock price and time, with simulated paths whose
 * volatility at each moment is read off the map. Toggle to the implied surface
 * σ_imp(K, T) on the same axes for comparison.
 */
export default function LocalVolMap() {
  const [view, setView] = useState<View>('local');
  const [p, setP] = useState<SSVIParams>({ ...EQUITY_SSVI });
  const [seed, setSeed] = useState(1);
  const lv = useMemo(() => ssviLocalVol(p, S0, r), [p]);
  const paths = useMemo(
    () => Array.from({ length: PATHS }, (_, i) => localVolPath(seed * 100 + i, S0, r, lv, 1, 120).S.map((s, j) => [j / 120, s] as [number, number])),
    [lv, seed],
  );
  const fwd = (T: number) => S0 * Math.exp(r * T);
  const implied = (K: number, T: number) => ssviVol(Math.log(K / fwd(T)), T, p);
  // Skews per 10% of moneyness at 3 months, near the money.
  const T = 0.25, h = 0.01, F = fwd(T);
  const localSkew = (lv(F * Math.exp(-h), T) - lv(F * Math.exp(h), T)) / (2 * h) * 0.1;
  const impliedSkew = (implied(F * Math.exp(-h), T) - implied(F * Math.exp(h), T)) / (2 * h) * 0.1;
  const range: [number, number] = [0.08, 0.4];

  return (
    <WidgetFrame
      title={view === 'local' ? 'The local volatility map' : 'The implied volatility map'}
      ariaLabel={`Local volatility over stock price and time for an equity-like surface, with ${PATHS} simulated paths. At three months, local skew is ${pct(localSkew)} per 10% move against ${pct(impliedSkew)} implied.`}
      plotHeight={HEIGHT}
      plot={
        <Heatmap
          f={view === 'local' ? (t, S) => lv(S, t) : (T, K) => implied(K, T)}
          x={[0.02, 1]}
          y={[60, 150]}
          height={HEIGHT}
          color="--c-vol"
          range={range}
          xTicks={[0.25, 0.5, 0.75, 1]}
          yTicks={[60, 80, 100, 120, 140]}
          formatX={(t) => `${t} yr`}
          formatY={(v) => `$${v}`}
          formatValue={pct}
          xLabel={view === 'local' ? 'time t' : 'maturity T'}
          yLabel={view === 'local' ? 'local vol at stock price S, time t' : 'implied vol at strike K, maturity T'}
          overlay={view === 'local' ? paths.map((pts) => ({ points: pts, color: 'var(--c-spot)', width: 1.4 })) : []}
          nx={80}
          ny={60}
        />
      }
      controls={
        <>
          <Segmented label="Surface" value={view} onChange={setView} options={[
            { value: 'local', label: 'Local vol + paths' },
            { value: 'implied', label: 'Implied vol' },
          ]} />
          <Button onClick={() => setSeed((s) => s + 1)}>New paths</Button>
          <Slider label="Skew ρ" value={p.rho} min={-0.9} max={0.5} step={0.05} onChange={(v) => setP({ ...p, rho: v })} format={(v) => v.toFixed(2)} color="var(--c-vol)" />
          <Slider label="Wings η" value={p.eta} min={0} max={1.5} step={0.05} onChange={(v) => setP({ ...p, eta: v })} format={(v) => v.toFixed(2)} color="var(--c-vol)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Implied skew (3 months)</dt><dd>{pct(impliedSkew)} <span className="muted">vol per 10% lower strike</span></dd>
          <dt>Local skew (3 months)</dt><dd>{pct(localSkew)} {Math.abs(impliedSkew) > 0.002 && <span className="muted">≈ {(localSkew / impliedSkew).toFixed(1)}× the implied skew</span>}</dd>
        </dl>
      }
      caption="Colour scale from 8% to 40% vol in both views. The local vol map is computed from the implied surface by Dupire's formula; each path's volatility at each moment is the colour under it."
    />
  );
}
