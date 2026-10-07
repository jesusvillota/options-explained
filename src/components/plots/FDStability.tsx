import { Line, Polyline } from 'mafs';
import { useMemo, useState } from 'react';
import { explicitStabilityLimit, interpolate, solveBlackScholesPDE } from '../../lib/numerics/finiteDifference';
import { DEFAULTS, price } from '../../lib/pricing/blackScholes';
import { Segmented, Slider } from '../ui/controls';
import { WidgetFrame } from '../ui/WidgetFrame';
import { money } from './format';
import { Label, PlotFrame } from './PlotFrame';

type Scheme = 'explicit' | 'implicit' | 'cn' | 'rannacher';
const SCHEME: Record<Scheme, { theta: number; rannacher: boolean; label: string }> = {
  explicit: { theta: 0, rannacher: false, label: 'Explicit' },
  implicit: { theta: 1, rannacher: false, label: 'Implicit' },
  cn: { theta: 0.5, rannacher: false, label: 'Crank–Nicolson' },
  rannacher: { theta: 0.5, rannacher: true, label: 'CN + Rannacher' },
};
const N_S = 100, SMAX = 200;
const HEIGHT = 300;

/**
 * Chapter 34: solve the Black–Scholes PDE for a 1-year call on a grid of 100
 * price steps and a chosen number of time steps. The explicit scheme is only
 * stable below a time-step limit; above it, errors explode into a sawtooth.
 */
export default function FDStability() {
  const [scheme, setScheme] = useState<Scheme>('explicit');
  const [nT, setNT] = useState(500);
  const { theta, rannacher } = SCHEME[scheme];
  const res = useMemo(() => solveBlackScholesPDE({ type: 'call', K: 100, r: 0.05, sigma: 0.2, T: 1, nS: N_S, nT, Smax: SMAX, theta, rannacher }), [nT, theta, rannacher]);
  const last = res.V[res.V.length - 1];
  const limit = explicitStabilityLimit({ sigma: 0.2, r: 0.05, nS: N_S });
  const minSteps = Math.ceil(1 / limit);
  const exactAt = (s: number) => price('call', { ...DEFAULTS, S: Math.max(s, 1e-9) });
  const exact = Array.from({ length: 81 }, (_, i) => [i * 2.5, exactAt(i * 2.5)] as [number, number]);
  const grid = res.S.map((s, i) => [s, Math.min(Math.max(last[i], -40), 140)] as [number, number]);
  const maxErr = Math.max(...res.S.map((s, i) => Math.abs(last[i] - exactAt(s))));
  const at100 = interpolate(res.S, last, 100);
  const exploded = maxErr > 1000;

  return (
    <WidgetFrame
      title="Solving the PDE on a grid"
      ariaLabel={`${SCHEME[scheme].label} scheme with ${nT} time steps: price at S = 100 is ${money(at100, 3)} against ${money(exactAt(100), 3)}; largest error ${maxErr.toExponential(1)}.`}
      plotHeight={HEIGHT}
      plot={
        <PlotFrame x={[0, SMAX]} y={[-40, 140]} height={HEIGHT} xTicks={[0, 50, 100, 150, 200]} yTicks={[0, 50, 100]} formatX={(v) => `$${v}`} formatY={(v) => money(v, 0)} baseline={0} xLabel="stock price S" yLabel="call value, 1 year to expiry">
          <Line.Segment point1={[100, -40]} point2={[100, 140]} color="var(--c-strike)" style="dashed" weight={1} />
          <Polyline points={exact} color="var(--text-muted)" weight={2} strokeStyle="dashed" fillOpacity={0} />
          <Polyline points={grid} color={exploded ? 'var(--c-put)' : 'var(--c-call)'} weight={2.5} fillOpacity={0} />
          <Label x={196} y={exactAt(196)} attach="nw" attachDistance={6} size={12} color="var(--text-muted)">exact</Label>
        </PlotFrame>
      }
      controls={
        <>
          <Segmented label="Scheme" value={scheme} onChange={setScheme} options={(Object.keys(SCHEME) as Scheme[]).map((k) => ({ value: k, label: SCHEME[k].label }))} />
          <Slider label="Time steps" value={nT} min={10} max={800} step={1} onChange={setNT} format={(v) => `${v} (Δτ = ${(1 / v).toFixed(4)})`} color="var(--c-time)" />
        </>
      }
      readout={
        <dl className="readout-grid">
          <dt>Price at S = $100</dt><dd className={exploded ? 'bad' : ''}>{exploded ? 'meaningless' : money(at100, 4)} <span className="muted">(exact {money(exactAt(100), 4)})</span></dd>
          <dt>Largest error on the grid</dt><dd className={exploded ? 'bad' : ''}>{maxErr < 1e4 ? maxErr.toFixed(4) : maxErr.toExponential(1)}</dd>
          <dt>Explicit stability</dt><dd>needs Δτ ≤ {limit.toFixed(4)}, i.e. at least {minSteps} steps {scheme === 'explicit' ? (nT >= minSteps ? '(satisfied)' : '(violated)') : '(irrelevant for this scheme)'}</dd>
        </dl>
      }
      caption="Price grid: 100 steps of \$2 from \$0 to \$200. Values beyond the plot are clipped. Dashed: the exact Black–Scholes curve. The explicit scheme turns red when its errors blow up."
    />
  );
}
